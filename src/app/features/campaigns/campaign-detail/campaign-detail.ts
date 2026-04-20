import { ChangeDetectionStrategy, Component, inject, signal, afterNextRender, OnDestroy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CampaignStatus, CampaignTab } from '../campaigns.model';
import { CampaignsService } from '../campaigns.service';
import { CampaignGroupsTab } from './groups-tab';
import { CampaignBusesTab } from './buses-tab';

@Component({
  selector: 'app-campaign-detail',
  imports: [DecimalPipe, CampaignGroupsTab, CampaignBusesTab],
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

  readonly tabs: { key: CampaignTab; label: string; icon: string }[] = [
    { key: 'groups', label: 'المجموعات', icon: 'pi pi-sitemap' },
    { key: 'buses',  label: 'الحافلات',  icon: 'pi pi-car'     },
  ];

  goBack(): void { this.router.navigate(['/campaigns']); }

  statusClass(status: CampaignStatus): string {
    return { 'نشطة': 'active', 'طارئة': 'urgent', 'مكتملة': 'done' }[status] ?? '';
  }
}
