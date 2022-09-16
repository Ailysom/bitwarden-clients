import { Component, OnDestroy } from "@angular/core";

import { ShareComponent as BaseShareComponent } from "@bitwarden/angular/components/share.component";
import { CipherAttachmentApiServiceAbstraction } from "@bitwarden/common/abstractions/cipher/cipher-attachment-api.service.abstraction";
import { CollectionService } from "@bitwarden/common/abstractions/collection.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { OrganizationService } from "@bitwarden/common/abstractions/organization.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { CollectionView } from "@bitwarden/common/models/view/collectionView";

@Component({
  selector: "app-vault-share",
  templateUrl: "share.component.html",
})
export class ShareComponent extends BaseShareComponent implements OnDestroy {
  constructor(
    collectionService: CollectionService,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    organizationService: OrganizationService,
    logService: LogService,
    cipherAttachmentApiService: CipherAttachmentApiServiceAbstraction
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

  ngOnDestroy() {
    this.selectAll(false);
  }

  check(c: CollectionView, select?: boolean) {
    (c as any).checked = select == null ? !(c as any).checked : select;
  }

  selectAll(select: boolean) {
    const collections = select ? this.collections : this.writeableCollections;
    collections.forEach((c) => this.check(c, select));
  }
}
