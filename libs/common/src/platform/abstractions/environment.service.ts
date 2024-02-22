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

/**
 * A subset of available regions, additional regions can be loaded through configuration.
 */
export enum Region {
  US = "US",
  EU = "EU",
  SelfHosted = "Self-hosted",
}

export type RegionConfig = {
  // Beware this isn't completely true, it's actually a string for custom environments,
  // which are currently only supported in web where it doesn't matter.
  key: Region;
  domain: string;
  urls: Urls;
};

export abstract class EnvironmentService {
  urls: Observable<void>;
  selectedRegion?: Region;
  initialized = true;

  /**
   * Retrieve all the available regions for environment selectors.
   *
   * This currently relies on compile time provided constants, and will not change at runtime.
   * Expect all builds to include production environments, QA builds to also include QA
   * environments and dev builds to include localhost.
   */
  availableRegions: () => RegionConfig[];

  /**
   * Set the global environment.
   */
  setEnvironment: (region: Region, urls?: Urls) => Promise<Urls>;

  /**
   * Load state from disk
   */
  setUrlsFromStorage: () => Promise<void>;

  /**
   * Seed the environment for a given user based on the globally set defaults.
   */
  seedUserEnvironment: (userId: UserId) => Promise<void>;

  // ----
  // The remaining functions should be removed
  // ----

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

  getSendUrl: () => string;
  getIconsUrl: () => string;
  getApiUrl: () => string;
  getIdentityUrl: () => string;
  getEventsUrl: () => string;
  getKeyConnectorUrl: () => string;
  getScimUrl: () => string;
  getHost: (userId?: string) => Promise<string>;
  getUrls: () => Urls;
  isCloud: () => boolean;
  isEmpty: () => boolean;
}
