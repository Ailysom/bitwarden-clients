import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { PasswordTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/password-token.request";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { IdentityCaptchaResponse } from "@bitwarden/common/auth/models/response/identity-captcha.response";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { IdentityTwoFactorResponse } from "@bitwarden/common/auth/models/response/identity-two-factor.response";
import { MasterPasswordPolicyResponse } from "@bitwarden/common/auth/models/response/master-password-policy.response";
import { IUserDecryptionOptionsServerResponse } from "@bitwarden/common/auth/models/response/user-decryption-options/user-decryption-options.response";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  Account,
  AccountProfile,
  AccountTokens,
  AccountKeys,
  AccountDecryptionOptions,
} from "@bitwarden/common/platform/models/domain/account";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import {
  PasswordStrengthServiceAbstraction,
  PasswordStrengthService,
} from "@bitwarden/common/tools/password-strength";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserKey, MasterKey, DeviceKey } from "@bitwarden/common/types/key";

import { LoginStrategyServiceAbstraction } from "../abstractions/login-strategy.service";
import { PasswordLoginCredentials } from "../models/domain/login-credentials";

import { PasswordLoginStrategy, PasswordLoginStrategyData } from "./password-login.strategy";

const email = "hello@world.com";
const masterPassword = "password";

const deviceId = Utils.newGuid();
const accessToken = "ACCESS_TOKEN";
const refreshToken = "REFRESH_TOKEN";
const userKey = "USER_KEY";
const privateKey = "PRIVATE_KEY";
const captchaSiteKey = "CAPTCHA_SITE_KEY";
const kdf = 0;
const kdfIterations = 10000;
const userId = Utils.newGuid();
const masterPasswordHash = "MASTER_PASSWORD_HASH";
const name = "NAME";
const defaultUserDecryptionOptionsServerResponse: IUserDecryptionOptionsServerResponse = {
  HasMasterPassword: true,
};

const decodedToken = {
  sub: userId,
  name: name,
  email: email,
  premium: false,
};

const twoFactorProviderType = TwoFactorProviderType.Authenticator;
const twoFactorToken = "TWO_FACTOR_TOKEN";
const twoFactorRemember = true;

export function identityTokenResponseFactory(
  masterPasswordPolicyResponse: MasterPasswordPolicyResponse = null,
  userDecryptionOptions: IUserDecryptionOptionsServerResponse = null,
) {
  return new IdentityTokenResponse({
    ForcePasswordReset: false,
    Kdf: kdf,
    KdfIterations: kdfIterations,
    Key: userKey,
    PrivateKey: privateKey,
    ResetMasterPassword: false,
    access_token: accessToken,
    expires_in: 3600,
    refresh_token: refreshToken,
    scope: "api offline_access",
    token_type: "Bearer",
    MasterPasswordPolicy: masterPasswordPolicyResponse,
    UserDecryptionOptions: userDecryptionOptions || defaultUserDecryptionOptionsServerResponse,
  });
}

// TODO: add tests for latest changes to base class for TDE
describe("LoginStrategy", () => {
  let cache: PasswordLoginStrategyData;

  let loginStrategyService: MockProxy<LoginStrategyServiceAbstraction>;
  let cryptoService: MockProxy<CryptoService>;
  let apiService: MockProxy<ApiService>;
  let tokenService: MockProxy<TokenService>;
  let appIdService: MockProxy<AppIdService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let messagingService: MockProxy<MessagingService>;
  let logService: MockProxy<LogService>;
  let stateService: MockProxy<StateService>;
  let twoFactorService: MockProxy<TwoFactorService>;
  let policyService: MockProxy<PolicyService>;
  let passwordStrengthService: MockProxy<PasswordStrengthServiceAbstraction>;

  let passwordLoginStrategy: PasswordLoginStrategy;
  let credentials: PasswordLoginCredentials;

  beforeEach(async () => {
    loginStrategyService = mock<LoginStrategyServiceAbstraction>();
    cryptoService = mock<CryptoService>();
    apiService = mock<ApiService>();
    tokenService = mock<TokenService>();
    appIdService = mock<AppIdService>();
    platformUtilsService = mock<PlatformUtilsService>();
    messagingService = mock<MessagingService>();
    logService = mock<LogService>();
    stateService = mock<StateService>();
    twoFactorService = mock<TwoFactorService>();
    policyService = mock<PolicyService>();
    passwordStrengthService = mock<PasswordStrengthService>();

    appIdService.getAppId.mockResolvedValue(deviceId);
    tokenService.decodeToken.calledWith(accessToken).mockResolvedValue(decodedToken);

    // The base class is abstract so we test it via PasswordLoginStrategy
    passwordLoginStrategy = new PasswordLoginStrategy(
      cache,
      cryptoService,
      apiService,
      tokenService,
      appIdService,
      platformUtilsService,
      messagingService,
      logService,
      stateService,
      twoFactorService,
      passwordStrengthService,
      policyService,
      loginStrategyService,
    );
    credentials = new PasswordLoginCredentials(email, masterPassword);
  });

  describe("base class", () => {
    const userKeyBytesLength = 64;
    const masterKeyBytesLength = 64;
    let userKey: UserKey;
    let masterKey: MasterKey;

    beforeEach(() => {
      userKey = new SymmetricCryptoKey(
        new Uint8Array(userKeyBytesLength).buffer as CsprngArray,
      ) as UserKey;
      masterKey = new SymmetricCryptoKey(
        new Uint8Array(masterKeyBytesLength).buffer as CsprngArray,
      ) as MasterKey;
    });

    it("sets the local environment after a successful login with master password", async () => {
      const idTokenResponse = identityTokenResponseFactory();
      apiService.postIdentityToken.mockResolvedValue(idTokenResponse);

      await passwordLoginStrategy.logIn(credentials);

      expect(stateService.addAccount).toHaveBeenCalledWith(
        new Account({
          profile: {
            ...new AccountProfile(),
            ...{
              userId: userId,
              name: name,
              email: email,
              hasPremiumPersonally: false,
              kdfIterations: kdfIterations,
              kdfType: kdf,
            },
          },
          tokens: {
            ...new AccountTokens(),
            ...{
              accessToken: accessToken,
              refreshToken: refreshToken,
            },
          },
          keys: new AccountKeys(),
          decryptionOptions: AccountDecryptionOptions.fromResponse(idTokenResponse),
        }),
      );
      expect(messagingService.send).toHaveBeenCalledWith("loggedIn");
    });

    it("persists a device key for trusted device encryption when it exists on login", async () => {
      // Arrange
      const idTokenResponse = identityTokenResponseFactory();
      apiService.postIdentityToken.mockResolvedValue(idTokenResponse);

      const deviceKey = new SymmetricCryptoKey(
        new Uint8Array(userKeyBytesLength).buffer as CsprngArray,
      ) as DeviceKey;

      stateService.getDeviceKey.mockResolvedValue(deviceKey);

      const accountKeys = new AccountKeys();
      accountKeys.deviceKey = deviceKey;

      // Act
      await passwordLoginStrategy.logIn(credentials);

      // Assert
      expect(stateService.addAccount).toHaveBeenCalledWith(
        expect.objectContaining({ keys: accountKeys }),
      );
    });

    it("builds AuthResult", async () => {
      const tokenResponse = identityTokenResponseFactory();
      tokenResponse.forcePasswordReset = true;
      tokenResponse.resetMasterPassword = true;

      apiService.postIdentityToken.mockResolvedValue(tokenResponse);

      const result = await passwordLoginStrategy.logIn(credentials);

      expect(result).toEqual({
        forcePasswordReset: ForceSetPasswordReason.AdminForcePasswordReset,
        resetMasterPassword: true,
        twoFactorProviders: null,
        captchaSiteKey: "",
      } as AuthResult);
    });

    it("rejects login if CAPTCHA is required", async () => {
      // Sample CAPTCHA response
      const tokenResponse = new IdentityCaptchaResponse({
        error: "invalid_grant",
        error_description: "Captcha required.",
        HCaptcha_SiteKey: captchaSiteKey,
      });

      apiService.postIdentityToken.mockResolvedValue(tokenResponse);
      cryptoService.getMasterKey.mockResolvedValue(masterKey);
      cryptoService.decryptUserKeyWithMasterKey.mockResolvedValue(userKey);

      const result = await passwordLoginStrategy.logIn(credentials);

      expect(stateService.addAccount).not.toHaveBeenCalled();
      expect(messagingService.send).not.toHaveBeenCalled();

      const expected = new AuthResult();
      expected.captchaSiteKey = captchaSiteKey;
      expect(result).toEqual(expected);
    });

    it("makes a new public and private key for an old account", async () => {
      const tokenResponse = identityTokenResponseFactory();
      tokenResponse.privateKey = null;
      cryptoService.makeKeyPair.mockResolvedValue(["PUBLIC_KEY", new EncString("PRIVATE_KEY")]);

      apiService.postIdentityToken.mockResolvedValue(tokenResponse);
      cryptoService.getMasterKey.mockResolvedValue(masterKey);
      cryptoService.decryptUserKeyWithMasterKey.mockResolvedValue(userKey);

      await passwordLoginStrategy.logIn(credentials);

      // User symmetric key must be set before the new RSA keypair is generated
      expect(cryptoService.setUserKey).toHaveBeenCalled();
      expect(cryptoService.makeKeyPair).toHaveBeenCalled();
      expect(cryptoService.setUserKey.mock.invocationCallOrder[0]).toBeLessThan(
        cryptoService.makeKeyPair.mock.invocationCallOrder[0],
      );

      expect(apiService.postAccountKeys).toHaveBeenCalled();
    });
  });

  describe("Two-factor authentication", () => {
    it("rejects login if 2FA is required", async () => {
      // Sample response where TOTP 2FA required
      const tokenResponse = new IdentityTwoFactorResponse({
        TwoFactorProviders: ["0"],
        TwoFactorProviders2: { 0: null },
        error: "invalid_grant",
        error_description: "Two factor required.",
        // only sent for emailed 2FA
        email: undefined,
        ssoEmail2faSessionToken: undefined,
      });

      apiService.postIdentityToken.mockResolvedValue(tokenResponse);

      const result = await passwordLoginStrategy.logIn(credentials);

      expect(stateService.addAccount).not.toHaveBeenCalled();
      expect(messagingService.send).not.toHaveBeenCalled();

      const expected = new AuthResult();
      expected.twoFactorProviders = new Map<TwoFactorProviderType, { [key: string]: string }>();
      expected.twoFactorProviders.set(0, null);
      expect(result).toEqual(expected);
    });

    it("rejects login if 2FA via email is required + maps required information", async () => {
      // Sample response where Email 2FA required

      const userEmail = "kyle@bitwarden.com";
      const ssoEmail2FaSessionToken =
        "BwSsoEmail2FaSessionToken_CfDJ8AMrVzKqBFpKqzzsahUx8ubIi9AhHm6aLHDLpCUYc3QV3qC14iuSVkNg57Q7-kGQUn1z87bGY1WP58jFMNJ6ndaurIgQWNfPNN4DG-dBhvzarOAZ0RKY5oKT5futWm6_k9NMMGd8PcGGHg5Pq1_koOIwRtiXO3IpD-bemB7m8oEvbj__JTQP3Mcz-UediFlCbYBKU3wyIiBL_tF8hW5D4RAUa5ZzXIuauJiiCdDS7QOzBcqcusVAPGFfKjfIdAwFfKSOYd5KmYrhK7Y7ymjweP_igPYKB5aMfcVaYr5ux-fdffeJTGqtJorwNjLUYNv7KA";

      const tokenResponse = new IdentityTwoFactorResponse({
        TwoFactorProviders: ["1"],
        TwoFactorProviders2: { "1": { Email: "k***@bitwarden.com" } },
        error: "invalid_grant",
        error_description: "Two factor required.",
        // only sent for emailed 2FA
        email: userEmail,
        ssoEmail2faSessionToken: ssoEmail2FaSessionToken,
      });

      apiService.postIdentityToken.mockResolvedValue(tokenResponse);

      const result = await passwordLoginStrategy.logIn(credentials);

      expect(stateService.addAccount).not.toHaveBeenCalled();
      expect(messagingService.send).not.toHaveBeenCalled();

      const expected = new AuthResult();
      expected.twoFactorProviders = new Map<TwoFactorProviderType, { [key: string]: string }>();
      expected.twoFactorProviders.set(1, { Email: "k***@bitwarden.com" });
      expected.email = userEmail;
      expected.ssoEmail2FaSessionToken = ssoEmail2FaSessionToken;

      expect(result).toEqual(expected);
    });

    it("sends stored 2FA token to server", async () => {
      tokenService.getTwoFactorToken.mockResolvedValue(twoFactorToken);
      apiService.postIdentityToken.mockResolvedValue(identityTokenResponseFactory());

      await passwordLoginStrategy.logIn(credentials);

      expect(apiService.postIdentityToken).toHaveBeenCalledWith(
        expect.objectContaining({
          twoFactor: {
            provider: TwoFactorProviderType.Remember,
            token: twoFactorToken,
            remember: false,
          } as TokenTwoFactorRequest,
        }),
      );
    });

    it("sends 2FA token provided by user to server (single step)", async () => {
      // This occurs if the user enters the 2FA code as an argument in the CLI
      apiService.postIdentityToken.mockResolvedValue(identityTokenResponseFactory());
      credentials.twoFactor = new TokenTwoFactorRequest(
        twoFactorProviderType,
        twoFactorToken,
        twoFactorRemember,
      );

      await passwordLoginStrategy.logIn(credentials);

      expect(apiService.postIdentityToken).toHaveBeenCalledWith(
        expect.objectContaining({
          twoFactor: {
            provider: twoFactorProviderType,
            token: twoFactorToken,
            remember: twoFactorRemember,
          } as TokenTwoFactorRequest,
        }),
      );
    });

    it("sends 2FA token provided by user to server (two-step)", async () => {
      // Simulate a partially completed login
      cache = new PasswordLoginStrategyData();
      cache.tokenRequest = new PasswordTokenRequest(email, masterPasswordHash, null, null);

      passwordLoginStrategy = new PasswordLoginStrategy(
        cache,
        cryptoService,
        apiService,
        tokenService,
        appIdService,
        platformUtilsService,
        messagingService,
        logService,
        stateService,
        twoFactorService,
        passwordStrengthService,
        policyService,
        loginStrategyService,
      );

      apiService.postIdentityToken.mockResolvedValue(identityTokenResponseFactory());

      await passwordLoginStrategy.logInTwoFactor(
        new TokenTwoFactorRequest(twoFactorProviderType, twoFactorToken, twoFactorRemember),
        null,
      );

      expect(apiService.postIdentityToken).toHaveBeenCalledWith(
        expect.objectContaining({
          twoFactor: {
            provider: twoFactorProviderType,
            token: twoFactorToken,
            remember: twoFactorRemember,
          } as TokenTwoFactorRequest,
        }),
      );
    });
  });
});
