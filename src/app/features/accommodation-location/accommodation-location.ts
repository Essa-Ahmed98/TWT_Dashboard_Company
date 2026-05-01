import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { MessageService } from 'primeng/api';

import { AuthService } from '../../core/auth/services/auth';
import { CampaignsService } from '../campaigns/campaigns.service';
import { CampaignApiItem, GroupApiItem } from '../campaigns/campaigns.model';
import { ApiResult } from '../../core/models/api.models';
import { environment } from '../../../environments/environment';

interface AccommodationLocationRequest {
  GroupId:               string;
  AccommodationLocation: string;
  Latitude:              number;
  Longitude:             number;
}

@Component({
  selector: 'app-accommodation-location',
  imports: [FormsModule],
  templateUrl: './accommodation-location.html',
  styleUrl: './accommodation-location.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccommodationLocation implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;

  private readonly destroyRef       = inject(DestroyRef);
  private readonly isBrowser        = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly http             = inject(HttpClient);
  private readonly auth             = inject(AuthService);
  private readonly campaignsService = inject(CampaignsService);
  private readonly toast            = inject(MessageService);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private leafletMap: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private marker: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private L: any = null;

  // ── Campaign dropdown ─────────────────────────────────────────
  showCampDrop     = signal(false);
  campLoading      = signal(false);
  selectedCampId   = signal('');
  selectedCampName = signal('');
  campList         = signal<CampaignApiItem[]>([]);

  // ── Group dropdown ────────────────────────────────────────────
  showGrpDrop       = signal(false);
  grpLoading        = signal(false);
  selectedGroupId   = signal('');
  selectedGroupName = signal('');
  grpList           = signal<GroupApiItem[]>([]);

  // ── Form fields ───────────────────────────────────────────────
  accommodationName = signal('');
  lat               = signal(21.4225);
  lng               = signal(39.8262);

  // ── Submit state ──────────────────────────────────────────────
  submitting  = signal(false);
  submitError = signal<string | null>(null);

  readonly canSubmit = computed(() =>
    !!this.selectedGroupId() &&
    this.accommodationName().trim().length > 0 &&
    !this.submitting()
  );

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    this.fetchCampaigns();
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    requestAnimationFrame(() => requestAnimationFrame(() => this.initMap()));
  }

  private fetchCampaigns(): void {
    const companyId = this.auth.currentUser()?.companyId;
    if (!companyId) return;
    this.campLoading.set(true);
    this.campaignsService.getAllCampaigns(String(companyId))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => { this.campList.set(data); this.campLoading.set(false); });
  }

  private fetchGroups(campaignId: string): void {
    this.grpLoading.set(true);
    this.http
      .get<ApiResult<GroupApiItem[]>>(`${environment.apiBase}/Groups/all/${campaignId}`)
      .pipe(finalize(() => this.grpLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe(res => { if (res.IsSuccess) this.grpList.set(res.Data); });
  }

  // ── Map ───────────────────────────────────────────────────────
  private async initMap(): Promise<void> {
    if (!this.mapEl?.nativeElement) return;

    const leafletModule = await import('leaflet');
    this.L = (leafletModule as unknown as { default: unknown }).default ?? leafletModule;
    const L = this.L;

    delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
      iconUrl:       'assets/leaflet/marker-icon.png',
      shadowUrl:     'assets/leaflet/marker-shadow.png',
    });

    const map = L.map(this.mapEl.nativeElement, {
      center: [this.lat(), this.lng()] as [number, number],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    this.marker = L.marker([this.lat(), this.lng()] as [number, number], {
      draggable: true,
    }).addTo(map);

    this.marker.on('dragend', () => {
      const { lat, lng } = this.marker.getLatLng();
      this.lat.set(Number(lat.toFixed(6)));
      this.lng.set(Number(lng.toFixed(6)));
    });

    map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
      const lat = Number(e.latlng.lat.toFixed(6));
      const lng = Number(e.latlng.lng.toFixed(6));
      this.lat.set(lat);
      this.lng.set(lng);
      this.marker.setLatLng([lat, lng]);
    });

    this.leafletMap = map;
    setTimeout(() => map.invalidateSize(), 150);
  }

  onLatChange(value: string): void {
    const n = parseFloat(value);
    if (!Number.isFinite(n)) return;
    this.lat.set(n);
    this.marker?.setLatLng([n, this.lng()]);
  }

  onLngChange(value: string): void {
    const n = parseFloat(value);
    if (!Number.isFinite(n)) return;
    this.lng.set(n);
    this.marker?.setLatLng([this.lat(), n]);
  }

  // ── Dropdowns ─────────────────────────────────────────────────
  toggleCampDrop(): void {
    if (this.showCampDrop()) { this.showCampDrop.set(false); return; }
    this.showGrpDrop.set(false);
    this.showCampDrop.set(true);
  }

  selectCamp(item: CampaignApiItem): void {
    this.selectedCampId.set(item.Id);
    this.selectedCampName.set(item.Name);
    this.selectedGroupId.set('');
    this.selectedGroupName.set('');
    this.grpList.set([]);
    this.showCampDrop.set(false);
    this.fetchGroups(item.Id);
  }

  clearCamp(): void {
    this.selectedCampId.set('');
    this.selectedCampName.set('');
    this.selectedGroupId.set('');
    this.selectedGroupName.set('');
    this.grpList.set([]);
  }

  toggleGrpDrop(): void {
    if (!this.selectedCampId()) return;
    if (this.showGrpDrop()) { this.showGrpDrop.set(false); return; }
    this.showCampDrop.set(false);
    this.showGrpDrop.set(true);
    if (this.grpList().length === 0) this.fetchGroups(this.selectedCampId());
  }

  selectGrp(item: GroupApiItem): void {
    this.selectedGroupId.set(item.Id);
    this.selectedGroupName.set(item.Name);
    this.showGrpDrop.set(false);
  }

  clearGrp(): void {
    this.selectedGroupId.set('');
    this.selectedGroupName.set('');
  }

  closeAllDrops(): void {
    this.showCampDrop.set(false);
    this.showGrpDrop.set(false);
  }

  // ── Clear ─────────────────────────────────────────────────────
  private clearForm(): void {
    this.selectedCampId.set('');
    this.selectedCampName.set('');
    this.selectedGroupId.set('');
    this.selectedGroupName.set('');
    this.grpList.set([]);
    this.accommodationName.set('');
    this.lat.set(21.4225);
    this.lng.set(39.8262);
    this.marker?.setLatLng([21.4225, 39.8262]);
    this.leafletMap?.setView([21.4225, 39.8262], 14);
  }

  // ── Submit ────────────────────────────────────────────────────
  submit(): void {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.submitError.set(null);

    const payload: AccommodationLocationRequest = {
      GroupId:               this.selectedGroupId(),
      AccommodationLocation: this.accommodationName().trim(),
      Latitude:              this.lat(),
      Longitude:             this.lng(),
    };

    this.http
      .put<ApiResult<unknown>>(
        `${environment.apiBase}/Pilgrims/group/${this.selectedGroupId()}/accommodation-location`,
        payload,
      )
      .pipe(finalize(() => this.submitting.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  res => {
          if (res.IsSuccess) {
            this.toast.add({ severity: 'success', summary: 'تم التحديث', detail: 'تم تحديث موقع السكن بنجاح' });
            this.clearForm();
          } else {
            this.submitError.set('حدث خطأ أثناء تحديث السكن');
          }
        },
        error: () => this.submitError.set('حدث خطأ أثناء تحديث السكن'),
      });
  }

  ngOnDestroy(): void {
    this.leafletMap?.remove();
    this.leafletMap = null;
  }
}
