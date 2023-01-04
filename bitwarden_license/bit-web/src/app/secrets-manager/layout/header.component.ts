import { Component, Input } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, map, Observable } from "rxjs";

import { AccountService } from "@bitwarden/common/abstractions/account/account.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { AccountProfile } from "@bitwarden/common/models/domain/account";

@Component({
  selector: "sm-header",
  templateUrl: "./header.component.html",
})
export class HeaderComponent {
  @Input() title: string;
  @Input() searchTitle: string;

  protected routeData$: Observable<{ title: string; searchTitle: string }>;
  protected account$: Observable<AccountProfile>;

  constructor(
    private route: ActivatedRoute,
    private stateService: StateService,
    private accountService: AccountService
  ) {
    this.routeData$ = this.route.data.pipe(
      map((params) => {
        return {
          title: params.title,
          searchTitle: params.searchTitle,
        };
      })
    );

    this.account$ = combineLatest([
      this.accountService.activeAccount$,
      this.stateService.accounts$,
    ]).pipe(
      map(([activeAccount, accounts]) => {
        return accounts[activeAccount?.data?.id]?.profile;
      })
    );
  }
}
