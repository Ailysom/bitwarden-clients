import { Observable } from "rxjs";

import { UserId } from "../../types/guid";

export type Urls = {
  base?: string;
  webVault?: string;
  api?: string;
  identity?: string;
  icons?: string;
  notifications?: string;
  events?: string;
  keyConnector?: string;
  scim?: string;
};

export enum Region {
  US = "US",
  EU = "EU",
  SelfHosted = "Self-hosted",
}

export enum RegionDomain {
  US = "bitwarden.com",
  EU = "bitwarden.eu",
  USQA = "bitwarden.pw",
}

export type SelectableRegion = {
  key: Region | string;
  domain: string;
  urls: {
    vault: string;
  };
};

export const AVAILABLE_REGIONS: SelectableRegion[] = [
  {
    key: Region.US,
    domain: "bitwarden.com",
    urls: {
      vault: "https://vault.bitwarden.com",
    },
  },
  {
    key: Region.EU,
    domain: "bitwarden.eu",
    urls: {
      vault: "https://vault.bitwarden.eu",
    },
  },
];

export abstract class EnvironmentService {
  urls: Observable<void>;
  selectedRegion?: Region;
  initialized = true;

  hasBaseUrl: () => boolean;
  getNotificationsUrl: () => string;
  getWebVaultUrl: () => string;
  /**
   * Retrieves the URL of the cloud web vault app.
   *
   * @returns The URL of the cloud web vault app.
   * @remarks Use this method only in views exclusive to self-host instances.
   */
  getCloudWebVaultUrl: () => string;
  /**
   * Sets the URL of the cloud web vault app based on the region parameter.
   *
   * @param region - The region of the cloud web vault app.
   */
  setCloudWebVaultUrl: (region: Region) => void;

  /**
   * Seed the environment for a given user based on the globally set defaults.
   */
  seedUserEnvironment: (userId: UserId) => Promise<void>;

  getSendUrl: () => string;
  getIconsUrl: () => string;
  getApiUrl: () => string;
  getIdentityUrl: () => string;
  getEventsUrl: () => string;
  getKeyConnectorUrl: () => string;
  getScimUrl: () => string;
  setUrlsFromStorage: () => Promise<void>;
  setUrls: (urls: Urls) => Promise<Urls>;
  getHost: (userId?: string) => Promise<string>;
  setRegion: (region: Region) => Promise<void>;
  getUrls: () => Urls;
  isCloud: () => boolean;
  isEmpty: () => boolean;
}
