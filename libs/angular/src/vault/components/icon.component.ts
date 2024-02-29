import { ChangeDetectionStrategy, Component, Input, OnInit } from "@angular/core";
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  Observable,
} from "rxjs";

import { SettingsService } from "@bitwarden/common/abstractions/settings.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { buildCipherIcon } from "@bitwarden/common/vault/icon/build-cipher-icon";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

@Component({
  selector: "app-vault-icon",
  templateUrl: "icon.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent implements OnInit {
  @Input()
  set cipher(value: CipherView) {
    this.cipher$.next(value);
  }

  protected data$: Observable<{
    imageEnabled: boolean;
    image?: string;
    fallbackImage: string;
    icon?: string;
  }>;

  private cipher$ = new BehaviorSubject<CipherView>(undefined);

  constructor(
    private environmentService: EnvironmentService,
    private settingsService: SettingsService,
  ) {}

  async ngOnInit() {
    this.data$ = combineLatest([
      this.environmentService.environment$.pipe(map((e) => e.getIconsUrl())),
      this.settingsService.disableFavicon$.pipe(distinctUntilChanged()),
      this.cipher$.pipe(filter((c) => c !== undefined)),
    ]).pipe(
      map(([iconsUrl, disableFavicon, cipher]) =>
        buildCipherIcon(iconsUrl, cipher, disableFavicon),
      ),
    );
  }
}
