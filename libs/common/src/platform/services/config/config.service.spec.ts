/**
 * need to update test environment so structuredClone works appropriately
 * @jest-environment ../../libs/shared/test.environment.ts
 */

import { mock } from "jest-mock-extended";
import { Subject, firstValueFrom, of } from "rxjs";

import {
  FakeGlobalState,
  FakeSingleUserState,
  FakeStateProvider,
  mockAccountServiceWith,
} from "../../../../spec";
import { subscribeTo } from "../../../../spec/observable-tracker";
import { UserId } from "../../../types/guid";
import { ConfigApiServiceAbstraction } from "../../abstractions/config/config-api.service.abstraction";
import { ServerConfig } from "../../abstractions/config/server-config";
import { Environment, EnvironmentService } from "../../abstractions/environment.service";
import { LogService } from "../../abstractions/log.service";
import { Utils } from "../../misc/utils";
import { ServerConfigData } from "../../models/data/server-config.data";
import {
  EnvironmentServerConfigResponse,
  ServerConfigResponse,
  ThirdPartyServerConfigResponse,
} from "../../models/response/server-config.response";

import {
  ApiUrl,
  DefaultConfigService,
  RETRIEVAL_INTERVAL,
  GLOBAL_SERVER_CONFIGURATIONS,
  USER_SERVER_CONFIG,
} from "./default-config.service";

describe("ConfigService", () => {
  const configApiService = mock<ConfigApiServiceAbstraction>();
  const environmentService = mock<EnvironmentService>();
  const logService = mock<LogService>();
  let stateProvider: FakeStateProvider;
  let globalState: FakeGlobalState<Record<ApiUrl, ServerConfig>>;
  let userState: FakeSingleUserState<ServerConfig>;
  const activeApiUrl = apiUrl(0);
  const userId = "userId" as UserId;
  const accountService = mockAccountServiceWith(userId);
  const tooOld = new Date(Date.now() - 1.1 * RETRIEVAL_INTERVAL);

  beforeEach(() => {
    stateProvider = new FakeStateProvider(accountService);
    globalState = stateProvider.global.getFake(GLOBAL_SERVER_CONFIGURATIONS);
    userState = stateProvider.singleUser.getFake(userId, USER_SERVER_CONFIG);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe.each([null, userId])("active user: %s", (activeUserId) => {
    let sut: DefaultConfigService;

    beforeAll(async () => {
      await accountService.switchAccount(activeUserId);
    });

    beforeEach(() => {
      environmentService.environment$ = of(environmentFactory(activeApiUrl));
      sut = new DefaultConfigService(
        configApiService,
        environmentService,
        logService,
        stateProvider,
      );
    });

    describe("serverConfig$", () => {
      it.each([{}, null])("handles null stored state", async (globalTestState) => {
        globalState.stateSubject.next(globalTestState);
        userState.nextState(null);
        await expect(firstValueFrom(sut.serverConfig$)).resolves.not.toThrow();
      });

      describe.each(["stale", "missing"])("%s config", (configStateDescription) => {
        const userStored =
          configStateDescription === "missing"
            ? null
            : serverConfigFactory(activeApiUrl + userId, tooOld);
        const globalStored =
          configStateDescription === "missing"
            ? {}
            : {
                [activeApiUrl]: serverConfigFactory(activeApiUrl, tooOld),
              };

        beforeEach(() => {
          globalState.stateSubject.next(globalStored);
          userState.nextState(userStored);
        });

        // sanity check
        test("authed and unauthorized state are different", () => {
          expect(globalStored[activeApiUrl]).not.toEqual(userStored);
        });

        describe("fail to fetch", () => {
          beforeEach(() => {
            configApiService.get.mockRejectedValue(new Error("Unable to fetch"));
          });

          it("uses storage as fallback", async () => {
            const actual = await firstValueFrom(sut.serverConfig$);
            expect(actual).toEqual(activeUserId ? userStored : globalStored[activeApiUrl]);
            expect(configApiService.get).toHaveBeenCalledTimes(1);
          });

          it("does not error out when fetch fails", async () => {
            await expect(firstValueFrom(sut.serverConfig$)).resolves.not.toThrow();
            expect(configApiService.get).toHaveBeenCalledTimes(1);
          });

          it("logs an error when unable to fetch", async () => {
            await firstValueFrom(sut.serverConfig$);

            expect(logService.error).toHaveBeenCalledWith(
              `Unable to fetch ServerConfig from ${activeApiUrl}: Unable to fetch`,
            );
          });
        });

        describe("fetch success", () => {
          const response = serverConfigResponseFactory();
          const newConfig = new ServerConfig(new ServerConfigData(response));

          it("should be a new config", async () => {
            expect(newConfig).not.toEqual(activeUserId ? userStored : globalStored[activeApiUrl]);
          });

          it("fetches config from server when it's older than an hour", async () => {
            await firstValueFrom(sut.serverConfig$);

            expect(configApiService.get).toHaveBeenCalledTimes(1);
          });

          it("returns the updated config", async () => {
            configApiService.get.mockResolvedValue(response);

            const actual = await firstValueFrom(sut.serverConfig$);

            // This is the time the response is converted to a config
            expect(actual.utcDate).toAlmostEqual(newConfig.utcDate, 1000);
            delete actual.utcDate;
            delete newConfig.utcDate;

            expect(actual).toEqual(newConfig);
          });
        });
      });

      describe("fresh configuration", () => {
        const userStored = serverConfigFactory(activeApiUrl + userId);
        const globalStored = {
          [activeApiUrl]: serverConfigFactory(activeApiUrl),
        };
        beforeEach(() => {
          globalState.stateSubject.next(globalStored);
          userState.nextState(userStored);
        });
        it("does not fetch from server", async () => {
          await firstValueFrom(sut.serverConfig$);

          expect(configApiService.get).not.toHaveBeenCalled();
        });

        it("uses stored value", async () => {
          const actual = await firstValueFrom(sut.serverConfig$);
          expect(actual).toEqual(activeUserId ? userStored : globalStored[activeApiUrl]);
        });
      });
    });
  });

  describe("environment change", () => {
    let sut: DefaultConfigService;
    let environmentSubject: Subject<Environment>;

    beforeAll(async () => {
      // updating environment with an active account is undefined behavior
      await accountService.switchAccount(null);
    });

    beforeEach(() => {
      environmentSubject = new Subject<Environment>();
      environmentService.environment$ = environmentSubject;
      sut = new DefaultConfigService(
        configApiService,
        environmentService,
        logService,
        stateProvider,
      );
    });

    describe("serverConfig$", () => {
      it("emits a new config when the environment changes", async () => {
        const globalStored = {
          [apiUrl(0)]: serverConfigFactory(apiUrl(0)),
          [apiUrl(1)]: serverConfigFactory(apiUrl(1)),
        };
        globalState.stateSubject.next(globalStored);

        const spy = subscribeTo(sut.serverConfig$);

        environmentSubject.next(environmentFactory(apiUrl(0)));
        environmentSubject.next(environmentFactory(apiUrl(1)));

        const expected = [globalStored[apiUrl(0)], globalStored[apiUrl(1)]];

        const actual = await spy.pauseUntilReceived(2);
        expect(actual.length).toBe(2);

        // validate dates this is done separately because the dates are created when ServerConfig is initialized
        expect(actual[0].utcDate).toAlmostEqual(expected[0].utcDate, 1000);
        expect(actual[1].utcDate).toAlmostEqual(expected[1].utcDate, 1000);
        delete actual[0].utcDate;
        delete actual[1].utcDate;
        delete expected[0].utcDate;
        delete expected[1].utcDate;

        expect(actual).toEqual(expected);
        spy.unsubscribe();
      });
    });
  });
});

function apiUrl(count: number) {
  return `https://api${count}.test.com`;
}

function serverConfigFactory(hash: string, date: Date = new Date()) {
  const config = new ServerConfig(serverConfigDataFactory(hash));
  config.utcDate = date;
  return config;
}

function serverConfigDataFactory(hash?: string) {
  return new ServerConfigData(serverConfigResponseFactory(hash));
}

function serverConfigResponseFactory(hash?: string) {
  return new ServerConfigResponse({
    version: "myConfigVersion",
    gitHash: hash ?? Utils.newGuid(), // Use optional git hash to store uniqueness value
    server: new ThirdPartyServerConfigResponse({
      name: "myThirdPartyServer",
      url: "www.example.com",
    }),
    environment: new EnvironmentServerConfigResponse({
      vault: "vault.example.com",
    }),
    featureStates: {
      feat1: "off",
      feat2: "on",
      feat3: "off",
    },
  });
}

function environmentFactory(apiUrl: string) {
  return {
    getApiUrl: () => apiUrl,
  } as Environment;
}
