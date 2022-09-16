import { Component } from "@angular/core";

import { ShareComponent as BaseShareComponent } from "@bitwarden/angular/components/share.component";
import { CipherAttachmentApiServiceAbstraction } from "@bitwarden/common/abstractions/cipher/cipher-attachment-api.service.abstraction";
import { CollectionService } from "@bitwarden/common/abstractions/collection.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { OrganizationService } from "@bitwarden/common/abstractions/organization.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";

@Component({
  selector: "app-vault-share",
  templateUrl: "share.component.html",
})
export class ShareComponent extends BaseShareComponent {
  constructor(
    cipherAttachmentApiService: CipherAttachmentApiServiceAbstraction,
    i18nService: I18nService,
    collectionService: CollectionService,
    platformUtilsService: PlatformUtilsService,
    logService: LogService,
    organizationService: OrganizationService
  ) {
    super(
      collectionService,
      platformUtilsService,
      i18nService,
      logService,
      organizationService,
      cipherAttachmentApiService
    );
  }
}
