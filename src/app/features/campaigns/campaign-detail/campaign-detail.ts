import { ChangeDetectionStrategy, Component, inject, signal, afterNextRender, OnDestroy } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CampaignStatus, CampaignTab } from '../campaigns.model';
import { CampaignsService } from '../campaigns.service';
import { CampaignGroupsTab } from './groups-tab';
import { CampaignBusesTab } from './buses-tab';
import { AuthService } from '../../../core/auth/services/auth';
import { PERMISSIONS } from '../../../core/auth/permissions';

@Component({
  selector: 'app-campaign-detail',
  imports: [TranslateModule, DecimalPipe, CampaignGroupsTab, CampaignBusesTab],
  templateUrl: './campaign-detail.html',
  styleUrl: './campaign-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignDetail implements OnDestroy {
  private readonly route   = inject(ActivatedRoute);
  private readonly service = inject(CampaignsService);
  private readonly router  = inject(Router);

  readonly id       = this.route.snapshot.paramMap.get('id') ?? '';
  readonly campaign = this.service.currentCampaign;
  readonly loading  = this.service.detailLoading;

  constructor() {
    afterNextRender(() => this.service.loadById(this.id));
  }

  ngOnDestroy(): void {
    this.service.clearCurrentCampaign();
  }

  // ── Tabs ──────────────────────────────────────────────────────
  activeTab = signal<CampaignTab>('groups');

  private readonly auth = inject(AuthService);

  // staff see the buses tab only with the Buses permission (the groups list is open to every campaign reader)
  readonly tabs: { key: CampaignTab; labelKey: string; icon: string }[] = ([
    { key: 'groups', labelKey: 'CAMPAIGN_DETAIL.TABS.GROUPS', icon: 'pi pi-sitemap' },
    { key: 'buses',  labelKey: 'CAMPAIGN_DETAIL.TABS.BUSES',  icon: 'pi pi-car'     },
  ] as { key: CampaignTab; labelKey: string; icon: string }[])
    .filter(tab => tab.key !== 'buses' || this.auth.hasPermission(PERMISSIONS.Buses));

  goBack(): void { this.router.navigate(['/campaigns']); }

  statusClass(status: CampaignStatus): string {
    return status;
  }

  statusLabelKey(status: CampaignStatus): string {
    return {
      active: 'CAMPAIGNS.STATUS.ACTIVE',
      urgent: 'CAMPAIGNS.STATUS.URGENT',
      done:   'CAMPAIGNS.STATUS.DONE',
    }[status] ?? 'COMMON.NO_DATA';
  }
}
