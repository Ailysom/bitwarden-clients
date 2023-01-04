// eslint-disable-next-line no-restricted-imports
import { Arg, Substitute, SubstituteOf } from "@fluffy-spoon/substitute";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { CryptoService } from "@bitwarden/common/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/abstractions/encrypt.service";
import { AccountServiceImplementation } from "@bitwarden/common/services/account/account.service";
import { ContainerService } from "@bitwarden/common/services/container.service";
import { SettingsService } from "@bitwarden/common/services/settings.service";
import { StateService } from "@bitwarden/common/services/state.service";

describe("SettingsService", () => {
  let settingsService: SettingsService;

  let cryptoService: SubstituteOf<CryptoService>;
  let encryptService: SubstituteOf<EncryptService>;
  let stateService: SubstituteOf<StateService>;
  let accountService: MockProxy<AccountServiceImplementation>;
  let activeAccountUnlocked: BehaviorSubject<boolean>;

  beforeEach(() => {
    cryptoService = Substitute.for();
    encryptService = Substitute.for();
    stateService = Substitute.for();
    accountService = mock();
    activeAccountUnlocked = new BehaviorSubject(true);

    stateService.getSettings().resolves({ equivalentDomains: [["test"], ["domains"]] });
    accountService.activeAccountUnlocked$ = activeAccountUnlocked;
    (window as any).bitwardenContainerService = new ContainerService(cryptoService, encryptService);

    settingsService = new SettingsService(stateService, accountService);
  });

  afterEach(() => {
    activeAccountUnlocked.complete();
  });

  describe("getEquivalentDomains", () => {
    it("returns value", async () => {
      const result = await firstValueFrom(settingsService.settings$);

      expect(result).toEqual({
        equivalentDomains: [["test"], ["domains"]],
      });
    });
  });

  it("setEquivalentDomains", async () => {
    await settingsService.setEquivalentDomains([["test2"], ["domains2"]]);

    stateService.received(1).setSettings(Arg.any());

    expect((await firstValueFrom(settingsService.settings$)).equivalentDomains).toEqual([
      ["test2"],
      ["domains2"],
    ]);
  });

  it("clear", async () => {
    await settingsService.clear();

    stateService.received(1).setSettings(Arg.any(), Arg.any());

    expect(await firstValueFrom(settingsService.settings$)).toEqual({});
  });
});
