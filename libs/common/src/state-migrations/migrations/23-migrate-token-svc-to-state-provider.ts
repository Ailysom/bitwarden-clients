import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

// Types to represent data as it is stored in JSON
type ExpectedAccountType = {
  tokens?: {
    accessToken?: string;
    refreshToken?: string;
  };
  profile?: {
    apiKeyClientId?: string;
  };
  keys?: {
    apiKeyClientSecret?: string;
  };
};

type ExpectedGlobalType = {
  twoFactorToken?: string;
};

export const TWO_FACTOR_TOKEN_DISK_LOCAL: KeyDefinitionLike = {
  key: "twoFactorToken",
  stateDefinition: {
    name: "tokenDiskLocal",
  },
};

export const ACCESS_TOKEN_DISK: KeyDefinitionLike = {
  key: "accessToken", // matches KeyDefinition.key
  stateDefinition: {
    name: "tokenDisk", // matches StateDefinition.name
  },
};
export const REFRESH_TOKEN_DISK: KeyDefinitionLike = {
  key: "refreshToken",
  stateDefinition: {
    name: "tokenDisk",
  },
};

export const API_KEY_CLIENT_ID_DISK: KeyDefinitionLike = {
  key: "apiKeyClientId",
  stateDefinition: {
    name: "tokenDisk",
  },
};

export const API_KEY_CLIENT_SECRET_DISK: KeyDefinitionLike = {
  key: "apiKeyClientSecret",
  stateDefinition: {
    name: "tokenDisk",
  },
};

export class TokenServiceStateProviderMigrator extends Migrator<23, 24> {
  async migrate(helper: MigrationHelper): Promise<void> {
    // Move global data
    const globalData = await helper.get<ExpectedGlobalType>("global");

    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(
      userId: string,
      account: ExpectedAccountType,
      globalTwoFactorToken: string | undefined | null,
    ): Promise<void> {
      let updatedAccount = false;

      // migrate 2FA token from global to user state
      // Due to the existing implmentation, n users on the same device share the same global state value for 2FA token.
      // So, we will just migrate it to all users to keep it valid for whichever was the user that set it previously.
      // Note: don't bother migrating 2FA Token if user account is undefined
      if (globalTwoFactorToken != null && account != undefined) {
        await helper.setToUser(userId, TWO_FACTOR_TOKEN_DISK_LOCAL, globalTwoFactorToken);
        // Note: don't set updatedAccount to true here as we aren't udpating
        // the legacy user state, just migrating a global state to a new user state
      }

      // Migrate access token
      const existingAccessToken = account?.tokens?.accessToken;

      if (existingAccessToken != null) {
        // Only migrate data that exists
        await helper.setToUser(userId, ACCESS_TOKEN_DISK, existingAccessToken);
        delete account.tokens.accessToken;
        updatedAccount = true;
      }

      // Migrate refresh token
      const existingRefreshToken = account?.tokens?.refreshToken;

      if (existingRefreshToken != null) {
        await helper.setToUser(userId, REFRESH_TOKEN_DISK, existingRefreshToken);
        delete account.tokens.refreshToken;
        updatedAccount = true;
      }

      // Migrate API key client id
      const existingApiKeyClientId = account?.profile?.apiKeyClientId;

      if (existingApiKeyClientId != null) {
        await helper.setToUser(userId, API_KEY_CLIENT_ID_DISK, existingApiKeyClientId);
        delete account.profile.apiKeyClientId;
        updatedAccount = true;
      }

      // Migrate API key client secret
      const existingApiKeyClientSecret = account?.keys?.apiKeyClientSecret;
      if (existingApiKeyClientSecret != null) {
        await helper.setToUser(userId, API_KEY_CLIENT_SECRET_DISK, existingApiKeyClientSecret);
        delete account.keys.apiKeyClientSecret;
        updatedAccount = true;
      }

      if (updatedAccount) {
        // Save the migrated account only if it was updated
        await helper.set(userId, account);
      }
    }

    // await Promise.all([
    //   ...accounts.map(({ userId, account }) =>
    //     migrateAccount(userId, account, globalData?.twoFactorToken),
    //   ),
    // ]);

    // TODO: remove this once testing is done
    // use a loop for easier debugging instead of promise.all
    for (const { userId, account } of accounts) {
      await migrateAccount(userId, account, globalData?.twoFactorToken);
    }

    // Delete global data
    delete globalData?.twoFactorToken;
    await helper.set("global", globalData);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      // Rollback access token
      const migratedAccessToken = await helper.getFromUser<string>(userId, ACCESS_TOKEN_DISK);

      if (account?.tokens && migratedAccessToken != null) {
        account.tokens.accessToken = migratedAccessToken;
        await helper.set(userId, account);
      }

      await helper.setToUser(userId, ACCESS_TOKEN_DISK, null);

      // Rollback refresh token
      const migratedRefreshToken = await helper.getFromUser<string>(userId, REFRESH_TOKEN_DISK);

      if (account?.tokens && migratedRefreshToken != null) {
        account.tokens.refreshToken = migratedRefreshToken;
        await helper.set(userId, account);
      }

      await helper.setToUser(userId, REFRESH_TOKEN_DISK, null);

      // Rollback API key client id

      const migratedApiKeyClientId = await helper.getFromUser<string>(
        userId,
        API_KEY_CLIENT_ID_DISK,
      );

      if (account?.profile && migratedApiKeyClientId != null) {
        account.profile.apiKeyClientId = migratedApiKeyClientId;
        await helper.set(userId, account);
      }

      await helper.setToUser(userId, API_KEY_CLIENT_ID_DISK, null);

      // Rollback API key client secret
      const migratedApiKeyClientSecret = await helper.getFromUser<string>(
        userId,
        API_KEY_CLIENT_SECRET_DISK,
      );

      if (account?.keys && migratedApiKeyClientSecret != null) {
        account.keys.apiKeyClientSecret = migratedApiKeyClientSecret;
        await helper.set(userId, account);
      }

      await helper.setToUser(userId, API_KEY_CLIENT_SECRET_DISK, null);
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
