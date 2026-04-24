import {
  ChangeDetectionStrategy,
  Component, computed, signal, inject, PLATFORM_ID, DestroyRef,
  ViewChild, ElementRef, AfterViewInit, OnDestroy, effect, OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';

import {
  CampaignWithGroupsApiItem,
  GroupPilgrimMapApiItem,
  ZONE_TYPES, GeofenceZone, ZoneType, CreateGeoZoneRequest, UpdateGeoZoneRequest, ZONE_TYPE_API_MAP, GeoZoneApiItem,
} from './geofence.model';
import { GeofenceService } from './geofence.service';


interface AddZoneForm {
  name: string;
  type: ZoneType;
  description: string;
  lat: number;
  lng: number;
  radius: number;
  opacity: number;
  color: string;
}

interface CampaignGroup {
  id: string;
  name: string;
  pilgrimsCount: number;
  visible: boolean;
  color: string;
  baseLat: number;
  baseLng: number;
}

interface Campaign {
  id: string;
  name: string;
  number: string;
  groupsCount: number;
  expanded: boolean;
  groups: CampaignGroup[];
}

@Component({
  selector: 'app-geofence',
  imports: [FormsModule, ProgressSpinnerModule, DecimalPipe],
  templateUrl: './geofence.html',
  styleUrl: './geofence.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Geofence implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;

  private readonly service = inject(GeofenceService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(MessageService);
  private platformId = inject(PLATFORM_ID);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private leafletMap: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private circleRefs = new Map<string, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private labelRefs  = new Map<string, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private L: any = null;

  readonly pageSize = signal(10);

  zones           = signal<GeofenceZone[]>([]);
  zoneTypes       = ZONE_TYPES;
  showModal       = signal(false);
  selectedZoneId  = signal<string | null>(null);
  showPilgrims    = signal(false);
  pilgrimsFeatureEnabled = signal(false);
  selectingLocation = signal(false);
  activeTab            = signal<'zones' | 'campaigns'>('zones');
  searchQuery          = signal('');
  loading              = signal(false);
  totalCount           = signal(0);
  totalPages           = signal(0);
  currentPage          = signal(1);
  hasNext              = signal(false);
  hasPrevious          = signal(false);
  campaignsLoading     = signal(false);
  campaignsTotalCount  = signal(0);
  campaignsTotalPages  = signal(0);
  campaignsCurrentPage = signal(1);
  campaignsHasNext     = signal(false);
  campaignsHasPrevious = signal(false);
  campaignsLoaded      = signal(false);
  loadingGroupIds      = signal<Set<string>>(new Set());
  filterType           = signal('الكل');
  editingZoneId        = signal<string | null>(null);
  showFilterDropdown   = signal(false);
  submitting           = signal(false);
  deletingZoneId       = signal<string | null>(null);

  private readonly search$ = new Subject<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pilgrimLayer: any = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private groupLayers = new Map<string, any>();

  campaigns = signal<Campaign[]>([]);

  readonly filterOptions = ['الكل', 'مشعر مقدس', 'مخيم حملة'];

  private readonly TYPE_FILTER_MAP: Record<string, ZoneType | null> = {
    'الكل': null,
    'مشعر مقدس': 'مشعر مقدس',
    'مخيم حملة': 'مخيم حملة',
  };

  private readonly LOCATION_COORDS: Record<string, [number, number]> = {
    'مكة':    [21.4225, 39.8262],
    'منى':    [21.4132, 39.8905],
    'عرفات':  [21.3549, 39.9842],
    'مزدلفة': [21.3847, 39.9356],
  };

  private readonly LOCATION_RADIUS: Record<string, number> = {
    'مكة': 600, 'منى': 1000, 'عرفات': 1800, 'مزدلفة': 1200,
  };

  private readonly STATUS_COLOR: Record<string, string> = {
    safe: '#22c35d', warning: '#fb8c00', danger: '#e53935',
  };

  private readonly STATUS_LABEL: Record<string, string> = {
    safe: 'آمن', warning: 'تحذير', danger: 'خطر',
  };

  private readonly MOCK_PILGRIMS = [
    { id: 1,  name: 'عبدالرحمن أحمد',  location: 'منى',    status: 'safe',    campaign: 'حملة الراجحي الأولى'   },
    { id: 2,  name: 'محمد حسن علي',    location: 'عرفات',  status: 'warning', campaign: 'حملة مصر الرسمية'      },
    { id: 3,  name: 'خالد بن سعود',    location: 'مكة',    status: 'safe',    campaign: 'حملة النور المباركة'   },
    { id: 4,  name: 'أحمد الأردني',    location: 'منى',    status: 'safe',    campaign: 'حملة الأردن الرسمية'   },
    { id: 5,  name: 'عمر الفاروق',     location: 'مزدلفة', status: 'danger',  campaign: 'حملة الفرقان الذهبية'  },
    { id: 6,  name: 'يوسف العلي',      location: 'عرفات',  status: 'safe',    campaign: 'حملة الهدى الأولى'     },
    { id: 7,  name: 'إبراهيم محمود',   location: 'مكة',    status: 'safe',    campaign: 'حملة مصر الرسمية'      },
    { id: 8,  name: 'سعد الحربي',      location: 'منى',    status: 'warning', campaign: 'حملة الراجحي الثانية'  },
    { id: 9,  name: 'فيصل التركي',     location: 'عرفات',  status: 'safe',    campaign: 'حملة تركيا الكبرى'     },
    { id: 10, name: 'محمد الشمري',     location: 'مكة',    status: 'safe',    campaign: 'حملة البركة الأولى'    },
    { id: 11, name: 'عبدالله الغامدي', location: 'مزدلفة', status: 'warning', campaign: 'حملة الراجحي الثالثة' },
    { id: 12, name: 'كريم الأنصاري',   location: 'منى',    status: 'safe',    campaign: 'حملة المغرب الرسمية'   },
  ];

  form = signal<AddZoneForm>({
    name: '', type: 'مشعر مقدس', description: '',
    lat: 21.3549, lng: 39.9842, radius: 500, opacity: 0.22, color: '#22c35d',
  });

  stats = computed(() => {
    const z          = this.zones();
    const allGroups  = this.campaigns().flatMap(c => c.groups);
    const visGroups  = allGroups.filter(g => g.visible);
    const visHajj    = visGroups.reduce((sum, g) => sum + g.pilgrimsCount, 0);

    return [
      { label: 'إجمالي المناطق', value: this.totalCount(),                          color: '#0b405b' },
      { label: 'منطقة نشطة',    value: z.filter(x => x.status === 'active').length, color: '#22c35d' },
      { label: 'حاج معروض',     value: visHajj,                                     color: '#fb8c00' },
      { label: 'مجموعة مفعلة',  value: visGroups.length,                            color: '#e53935' },
    ];
  });

  filteredZones = computed(() => {
    const typeFilter = this.TYPE_FILTER_MAP[this.filterType()];
    return this.zones().filter(z => {
      const matchType   = !typeFilter || z.type === typeFilter;
      return matchType;
    });
  });

  readonly visiblePages = computed<Array<number | string>>(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: Array<number | string> = [1];
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  });

  readonly campaignVisiblePages = computed<Array<number | string>>(() => {
    const total = this.campaignsTotalPages();
    const current = this.campaignsCurrentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: Array<number | string> = [1];
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  });

  modalTitle = computed(() =>
    this.editingZoneId() !== null ? 'تعديل منطقة جغرافية' : 'إضافة منطقة جغرافية جديدة'
  );

  formValid = computed(() => {
    const form = this.form();
    return !!form.name.trim()
      && !!form.description.trim()
      && Number.isFinite(form.lat)
      && Number.isFinite(form.lng)
      && form.radius > 0
      && this.normalizeOpacity(form.opacity) === form.opacity
      && !!form.color
      && !!form.type;
  });

  constructor() {
    effect(() => {
      const zones = this.zones();
      if (this.leafletMap && this.L) {
        this.syncCircles(zones);
      }
    });
  }

  ngOnInit(): void {
    this.loadZones();
    this.search$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.currentPage.set(1);
        this.loadZones();
      });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    // Double rAF guarantees we're after the first browser paint,
    // so Leaflet reads the real container dimensions instead of 0×0.
    requestAnimationFrame(() => requestAnimationFrame(() => this.initMap()));
  }

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
      center: [21.3950, 39.9050] as [number, number],
      zoom: 11,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    this.leafletMap = map;
    map.on('click', (event: { latlng: { lat: number; lng: number } }) => this.handleMapPick(event));
    this.syncCircles(this.zones());

    // Safety net: recalculate size in case the container was still reflowing.
    setTimeout(() => map.invalidateSize(), 150);
  }

  togglePilgrims(): void {
    if (!this.pilgrimsFeatureEnabled()) {
      this.showPilgrims.set(false);
      this.pilgrimLayer?.remove();
      this.pilgrimLayer = null;
      return;
    }
    this.showPilgrims.update(v => !v);
    if (this.showPilgrims()) {
      this.addPilgrimMarkers();
    } else {
      this.pilgrimLayer?.remove();
      this.pilgrimLayer = null;
    }
  }

  private addPilgrimMarkers(): void {
    if (!this.L || !this.leafletMap) return;
    const L = this.L;

    this.pilgrimLayer = L.layerGroup().addTo(this.leafletMap);

    for (const p of this.MOCK_PILGRIMS) {
      const [lat, lng] = this.pilgrimPosition(p.id, p.location);
      const color = this.STATUS_COLOR[p.status];
      L.circleMarker([lat, lng] as [number, number], {
        radius: 7, color: '#fff', fillColor: color,
        fillOpacity: 0.9, weight: 1.5,
      }).bindPopup(`
        <div style="direction:rtl;font-family:inherit;min-width:160px">
          <div style="font-weight:700;color:#0b405b;margin-bottom:2px">${p.name}</div>
          <div style="font-size:.78rem;color:#647b87;margin-bottom:6px">${p.campaign}</div>
          <div style="font-size:.8rem">
            <span style="color:#647b87">الموقع: </span>${p.location}
          </div>
          <div style="font-size:.8rem">
            <span style="color:#647b87">الحالة: </span>
            <span style="color:${color};font-weight:600">${this.STATUS_LABEL[p.status]}</span>
          </div>
        </div>
      `).addTo(this.pilgrimLayer);
    }
  }

  private pilgrimPosition(id: number, location: string): [number, number] {
    const base = this.LOCATION_COORDS[location] ?? [21.4225, 39.8262];
    const r    = (this.LOCATION_RADIUS[location] ?? 500) * 0.0000085;
    const h1   = ((id * 1664525  + 1013904223) >>> 0) / 0xffffffff;
    const h2   = ((id * 22695477 + 1)          >>> 0) / 0xffffffff;
    return [base[0] + (h1 - 0.5) * 2 * r, base[1] + (h2 - 0.5) * 2 * r];
  }

  toggleZone(zone: GeofenceZone, event: Event): void {
    event.stopPropagation();
    this.zones.update(list =>
      list.map(z => z.id === zone.id ? { ...z, visible: !z.visible } : z)
    );
  }

  flyToZone(zone: GeofenceZone): void {
    if (!zone.visible) return;
    this.selectedZoneId.set(zone.id);
    if (!this.leafletMap || !this.L) return;

    const circle = this.circleRefs.get(zone.id);
    if (circle) {
      this.leafletMap.flyToBounds(circle.getBounds(), { padding: [40, 40], duration: 0.7 });
      setTimeout(() => circle.openPopup(), 750);
    }

    for (const [id, c] of this.circleRefs) {
      const z = this.zones().find(z => z.id === id);
      if (!z) continue;
      if (id === zone.id) {
        c.setStyle({ weight: 3.5, fillOpacity: Math.min(z.opacity + 0.08, 1), color: z.color });
      } else {
        c.setStyle({ weight: 2, fillOpacity: z.opacity, color: z.color });
      }
    }
  }

  selectFilter(opt: string): void {
    this.filterType.set(opt);
    this.showFilterDropdown.set(false);
  }

  setActiveTab(tab: 'zones' | 'campaigns'): void {
    this.activeTab.set(tab);
    if (tab === 'campaigns' && !this.campaignsLoaded() && !this.campaignsLoading()) {
      this.loadCampaigns();
    }
  }

  onSearch(value: string): void {
    this.searchQuery.set(value);
    this.search$.next(value);
  }

  goToPage(page: number | string): void {
    const p = +page;
    if (p < 1 || p > this.totalPages() || p === this.currentPage()) return;
    this.currentPage.set(p);
    this.loadZones();
  }

  nextPage(): void {
    if (!this.hasNext()) return;
    this.goToPage(this.currentPage() + 1);
  }

  prevPage(): void {
    if (!this.hasPrevious()) return;
    this.goToPage(this.currentPage() - 1);
  }

  goToCampaignsPage(page: number | string): void {
    const p = +page;
    if (p < 1 || p > this.campaignsTotalPages() || p === this.campaignsCurrentPage()) return;
    this.campaignsCurrentPage.set(p);
    this.loadCampaigns();
  }

  nextCampaignsPage(): void {
    if (!this.campaignsHasNext()) return;
    this.goToCampaignsPage(this.campaignsCurrentPage() + 1);
  }

  prevCampaignsPage(): void {
    if (!this.campaignsHasPrevious()) return;
    this.goToCampaignsPage(this.campaignsCurrentPage() - 1);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.campaignsCurrentPage.set(1);
    this.loadZones();
    if (this.campaignsLoaded()) this.loadCampaigns();
  }

  deleteZone(zone: GeofenceZone, event: Event): void {
    event.stopPropagation();
    if (this.deletingZoneId()) return;

    this.deletingZoneId.set(zone.id);
    this.service.deleteGeoZone(zone.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.deletingZoneId.set(null);
          if (res.IsSuccess) {
            if (this.selectedZoneId() === zone.id) {
              this.selectedZoneId.set(null);
            }
            this.loadZones();
            this.toast.add({ severity: 'success', summary: 'نجاح', detail: 'تم الحذف بنجاح' });
          } else {
            this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'لم تنجح العملية' });
          }
        },
        error: () => {
          this.deletingZoneId.set(null);
          this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'لم تنجح العملية' });
        },
      });
  }

  openModal(): void {
    this.editingZoneId.set(null);
    this.form.set({
      name: '', type: 'مشعر مقدس', description: '',
      lat: 21.3549, lng: 39.9842, radius: 500, opacity: 0.22, color: '#22c35d',
    });
    this.showModal.set(true);
  }

  openEditModal(zone: GeofenceZone, event: Event): void {
    event.stopPropagation();
    this.editingZoneId.set(zone.id);
    this.form.set({
      name: zone.name, type: zone.type, description: zone.description,
      lat: zone.lat, lng: zone.lng, radius: zone.radius,
      opacity: zone.opacity, color: zone.color,
    });
    this.showModal.set(true);
  }

  closeModal(): void {
    if (this.submitting()) return;
    this.showModal.set(false);
  }

  startLocationSelection(): void {
    if (!this.leafletMap || !this.L) {
      this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'الخريطة غير جاهزة بعد' });
      return;
    }
    this.showModal.set(false);
    this.selectingLocation.set(true);
    this.setMapPickingCursor(true);
  }

  cancelLocationSelection(): void {
    this.selectingLocation.set(false);
    this.setMapPickingCursor(false);
    this.showModal.set(true);
  }

  patchForm(patch: Partial<AddZoneForm>): void {
    this.form.update(f => ({ ...f, ...patch }));
  }

  private normalizeOpacity(value: number): number {
    if (Number.isNaN(value)) return 0;
    return Math.min(Math.max(value, 0), 1);
  }

  opacityPercent(value: number): number {
    return Math.round(this.normalizeOpacity(value) * 100);
  }

  private buildCreateRequest(form: AddZoneForm): CreateGeoZoneRequest {
    const opacity = this.normalizeOpacity(form.opacity);
    return {
      Name: form.name.trim(),
      Description: form.description.trim(),
      Opacity: String(opacity),
      Color: form.color,
      GeofenceType: ZONE_TYPE_API_MAP[form.type],
      Longitude: form.lng,
      Latitude: form.lat,
      RadiusMeters: form.radius,
    };
  }

  private buildUpdateRequest(id: string, form: AddZoneForm): UpdateGeoZoneRequest {
    return {
      Id: id,
      ...this.buildCreateRequest(form),
    };
  }

  submitForm(): void {
    const f      = this.form();
    const editId = this.editingZoneId();
    if (!this.formValid() || this.submitting()) return;
    const opacity = this.normalizeOpacity(f.opacity);

    if (editId !== null) {
      const request = this.buildUpdateRequest(editId, f);
      this.submitting.set(true);
      this.service.updateGeoZone(request)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: res => {
            this.submitting.set(false);
            if (res.IsSuccess) {
              this.loadZones();
              this.closeModal();
              this.toast.add({ severity: 'success', summary: 'نجاح', detail: 'تم تعديل المنطقة بنجاح' });
            } else {
              this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'لم تنجح العملية' });
            }
          },
          error: () => {
            this.submitting.set(false);
            this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'لم تنجح العملية' });
          },
        });
      return;
    }

    const request = this.buildCreateRequest(f);
    this.submitting.set(true);
    this.service.createGeoZone(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.submitting.set(false);
          if (res.IsSuccess) {
            this.loadZones();
            this.closeModal();
            this.toast.add({ severity: 'success', summary: 'نجاح', detail: 'تمت إضافة المنطقة بنجاح' });
          } else {
            this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'تعذرت إضافة المنطقة' });
          }
        },
        error: () => {
          this.submitting.set(false);
          this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'تعذرت إضافة المنطقة' });
        },
      });
  }

  private loadZones(): void {
    this.loading.set(true);
    this.service.getGeoZones({
      page: this.currentPage(),
      pageSize: this.pageSize(),
      search: this.searchQuery() || undefined,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.loading.set(false);
          if (!res.IsSuccess) return;

          this.zones.set(res.Data.Items.map(item => this.mapApiZone(item)));
          this.totalCount.set(res.Data.TotalCount);
          this.totalPages.set(res.Data.TotalPages);
          this.currentPage.set(res.Data.CurrentPage);
          this.hasNext.set(res.Data.HasNext);
          this.hasPrevious.set(res.Data.HasPrevious);
        },
        error: () => {
          this.loading.set(false);
          this.zones.set([]);
        },
      });
  }

  private loadCampaigns(): void {
    this.campaignsLoading.set(true);
    this.service.getCampaignsWithGroups({
      page: this.campaignsCurrentPage(),
      pageSize: this.pageSize(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.campaignsLoading.set(false);
          if (!res.IsSuccess) return;

          this.campaigns.set(res.Data.Items.map((item, index) => this.mapCampaign(item, index)));
          this.campaignsLoaded.set(true);
          this.campaignsTotalCount.set(res.Data.TotalCount);
          this.campaignsTotalPages.set(res.Data.TotalPages);
          this.campaignsCurrentPage.set(res.Data.CurrentPage);
          this.campaignsHasNext.set(res.Data.HasNext);
          this.campaignsHasPrevious.set(res.Data.HasPrevious);
        },
        error: () => {
          this.campaignsLoading.set(false);
          this.campaigns.set([]);
        },
      });
  }

  isOwnZone(zone: GeofenceZone): boolean {
    return !!zone.companyId;
  }

  private mapApiZone(item: GeoZoneApiItem): GeofenceZone {
    return {
      id: item.Id,
      name: item.Name,
      type: item.GeofenceType === 0 ? 'مشعر مقدس' : 'مخيم حملة',
      description: item.Description,
      lat: item.Latitude,
      lng: item.Longitude,
      radius: item.RadiusMeters,
      opacity: this.normalizeOpacity(Number(item.Opacity)),
      pilgrimsInside: item.PilgrimCount,
      color: item.Color,
      status: 'active',
      visible: true,
      companyId: item.CompanyId,
    };
  }

  private mapCampaign(item: CampaignWithGroupsApiItem, index: number): Campaign {
    return {
      id: item.Id,
      name: item.Name,
      number: item.Number,
      groupsCount: item.GroupsCount,
      expanded: false,
      groups: item.Groups.map((group, groupIndex) => this.mapCampaignGroup(group, item.Id, index, groupIndex)),
    };
  }

  private mapCampaignGroup(
    group: CampaignWithGroupsApiItem['Groups'][number],
    campaignId: string,
    campaignIndex: number,
    groupIndex: number,
  ): CampaignGroup {
    const palette = ['#1565c0', '#7c3aed', '#0891b2', '#15803d', '#e65100', '#b45309'];
    const anchorPoints: Array<[number, number]> = [
      [21.4225, 39.8262],
      [21.4132, 39.8905],
      [21.3549, 39.9842],
      [21.3847, 39.9356],
      [21.4200, 39.8731],
    ];
    const base = anchorPoints[(campaignIndex + groupIndex) % anchorPoints.length];

    return {
      id: group.Id,
      name: group.Name,
      pilgrimsCount: group.PilgrimCount,
      visible: false,
      color: palette[(campaignIndex + groupIndex) % palette.length],
      baseLat: base[0] + campaignIndex * 0.002 + groupIndex * 0.001,
      baseLng: base[1] + campaignIndex * 0.002 + groupIndex * 0.001,
    };
  }

  private handleMapPick(event: { latlng: { lat: number; lng: number } }): void {
    if (!this.selectingLocation() || !this.L || !this.leafletMap) return;

    const lat = Number(event.latlng.lat.toFixed(6));
    const lng = Number(event.latlng.lng.toFixed(6));
    this.patchForm({ lat, lng });
    this.selectingLocation.set(false);
    this.setMapPickingCursor(false);
    this.showModal.set(true);
  }

  private setMapPickingCursor(active: boolean): void {
    if (!this.mapEl?.nativeElement) return;
    this.mapEl.nativeElement.classList.toggle('gf__map-inner--picking', active);
  }

  private syncCircles(zones: GeofenceZone[]): void {
    if (!this.leafletMap || !this.L) return;
    const L = this.L;

    const currentIds = new Set(zones.map(z => z.id));

    for (const [id, circle] of this.circleRefs) {
      if (!currentIds.has(id)) {
        circle.remove();
        this.circleRefs.delete(id);
        this.labelRefs.get(id)?.remove();
        this.labelRefs.delete(id);
      }
    }

    for (const zone of zones) {
      const hasLayer = this.circleRefs.has(zone.id);

      if (!zone.visible) {
        if (hasLayer) {
          this.circleRefs.get(zone.id).remove();
          this.circleRefs.delete(zone.id);
          this.labelRefs.get(zone.id)?.remove();
          this.labelRefs.delete(zone.id);
        }
        continue;
      }

      if (hasLayer) {
        const c = this.circleRefs.get(zone.id);
        c.setLatLng([zone.lat, zone.lng]);
        c.setRadius(zone.radius);
        c.setStyle({ color: zone.color, fillColor: zone.color, fillOpacity: zone.opacity });
        c.setPopupContent(this.buildPopup(zone));
        this.labelRefs.get(zone.id)?.setLatLng([zone.lat, zone.lng]);
      } else {
        const circle = L.circle([zone.lat, zone.lng] as [number, number], {
          radius:      zone.radius,
          color:       zone.color,
          fillColor:   zone.color,
          fillOpacity: zone.opacity,
          weight:      2.5,
        }).bindPopup(this.buildPopup(zone)).addTo(this.leafletMap);

        circle.on('click', () => this.flyToZone(zone));
        this.circleRefs.set(zone.id, circle);

        const label = L.marker([zone.lat, zone.lng] as [number, number], {
          icon: L.divIcon({
            className: '',
            html: `<div class="zone-centre-label">
                     <span style="color:${zone.color}">${zone.name}</span>
                     <div class="zone-centre-label__dot" style="background:${zone.color}"></div>
                   </div>`,
            iconSize:   [120, 46],
            iconAnchor: [60, 23],
          }),
          interactive: false,
          zIndexOffset: 10,
        }).addTo(this.leafletMap);
        this.labelRefs.set(zone.id, label);
      }
    }

    if (zones.length > 0 && !this.leafletMap._initialFitDone) {
      this.leafletMap._initialFitDone = true;
      const allPoints = zones.flatMap(z => {
        const R = z.radius / 111320;
        return [
          [z.lat + R, z.lng + R] as [number, number],
          [z.lat - R, z.lng - R] as [number, number],
        ];
      });
      const bounds = L.latLngBounds(allPoints);
      this.leafletMap.fitBounds(bounds, { padding: [32, 32], maxZoom: 13 });
    }
  }

  private buildPopup(zone: GeofenceZone): string {
    return `
      <div style="direction:rtl;font-family:inherit;min-width:200px;padding:2px 0">
        <div style="font-weight:700;color:#0b405b;font-size:.925rem;margin-bottom:2px">${zone.name}</div>
        <div style="font-size:.78rem;color:#647b87;margin-bottom:8px">${zone.type}</div>
        <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:4px">
          <span style="color:#647b87">الحجاج داخل المنطقة</span>
          <span style="font-weight:600;color:#0b405b">${zone.pilgrimsInside}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:4px">
          <span style="color:#647b87">Opacity</span>
          <span style="font-weight:600;color:#0b405b">${Math.round(zone.opacity * 100)}%</span>
        </div>
        <div style="height:8px;background:#eef0f4;border-radius:100px;overflow:hidden">
          <div style="height:100%;width:${zone.opacity * 100}%;background:${zone.color};border-radius:100px"></div>
        </div>
        <div style="margin-top:8px;font-size:.78rem;color:#647b87">
          نصف القطر: ${zone.radius} متر
        </div>
      </div>`;
  }

  // ── Campaigns ─────────────────────────────────────────────────
  toggleCampaign(id: string): void {
    this.campaigns.update(list =>
      list.map(c => c.id === id ? { ...c, expanded: !c.expanded } : c)
    );
  }

  allGroupsVisible(campaign: Campaign): boolean {
    return campaign.groups.length > 0 && campaign.groups.every(g => g.visible);
  }

  toggleAllGroups(campaign: Campaign, event: Event): void {
    event.stopPropagation();
    const newVisible = !this.allGroupsVisible(campaign);
    this.campaigns.update(list =>
      list.map(c => c.id === campaign.id
        ? { ...c, groups: c.groups.map(g => ({ ...g, visible: newVisible })) }
        : c
      )
    );
    for (const g of campaign.groups) {
      this.applyGroupLayer({ ...g, visible: newVisible });
    }
  }

  toggleGroupVisibility(campaignId: string, groupId: string, event: Event): void {
    event.stopPropagation();
    let updated: CampaignGroup | undefined;
    this.campaigns.update(list =>
      list.map(c => c.id === campaignId
        ? { ...c, groups: c.groups.map(g => {
            if (g.id === groupId) { updated = { ...g, visible: !g.visible }; return updated; }
            return g;
          })}
        : c
      )
    );
    if (updated) this.applyGroupLayer(updated);
  }

  isGroupLoading(groupId: string): boolean {
    return this.loadingGroupIds().has(groupId);
  }

  private applyGroupLayer(group: CampaignGroup): void {
    if (!this.L || !this.leafletMap) return;
    // Always clear existing layer first
    if (this.groupLayers.has(group.id)) {
      this.groupLayers.get(group.id).remove();
      this.groupLayers.delete(group.id);
    }
    if (!group.visible) return;

    this.loadingGroupIds.update(ids => new Set(ids).add(group.id));
    this.service.getPilgrimsInGroup(group.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.loadingGroupIds.update(ids => {
            const nextIds = new Set(ids);
            nextIds.delete(group.id);
            return nextIds;
          });
          if (!res.IsSuccess || !this.isGroupVisible(group.id)) return;

          const L = this.L;
          const layer = L.layerGroup().addTo(this.leafletMap);
          for (const pilgrim of res.Data) {
            L.circleMarker([pilgrim.Latitude, pilgrim.Longitude] as [number, number], {
              radius: 7,
              color: '#fff',
              fillColor: group.color,
              fillOpacity: 0.9,
              weight: 1.5,
            }).bindPopup(this.buildPilgrimPopup(pilgrim, group)).addTo(layer);
          }
          this.groupLayers.set(group.id, layer);
        },
        error: () => {
          this.loadingGroupIds.update(ids => {
            const nextIds = new Set(ids);
            nextIds.delete(group.id);
            return nextIds;
          });
          if (!this.isGroupVisible(group.id)) return;
          this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'تعذر عرض الحجاج على الخريطة' });
        },
      });
  }

  private isGroupVisible(groupId: string): boolean {
    return this.campaigns().some(c => c.groups.some(g => g.id === groupId && g.visible));
  }

  private buildPilgrimPopup(pilgrim: GroupPilgrimMapApiItem, group: CampaignGroup): string {
    return `
      <div style="direction:rtl;font-family:inherit;min-width:180px">
        <div style="font-weight:700;color:#0b405b;margin-bottom:4px">${pilgrim.DisplayName}</div>
        <div style="font-size:.8rem;color:#647b87;margin-bottom:4px">المجموعة: ${group.name}</div>
      </div>`;
  }

  ngOnDestroy(): void {
    for (const layer of this.groupLayers.values()) layer.remove();
    this.groupLayers.clear();
    this.leafletMap?.remove();
    this.leafletMap = null;
  }
}
