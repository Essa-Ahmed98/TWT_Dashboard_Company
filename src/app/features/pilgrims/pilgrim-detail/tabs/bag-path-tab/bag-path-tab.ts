import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject,
  input,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PilgrimsService } from '../../../pilgrims.service';
import { loadLeaflet } from '../../../../../shared/utils/leaflet-loader';

interface BagLocationPoint {
  id: string;
  latitude: number;
  longitude: number;
  order: number;
  timestamp: string;
  recordedAt: string;
}

@Component({
  selector: 'app-bag-path-tab',
  imports: [TranslateModule],
  templateUrl: './bag-path-tab.html',
  styleUrl: './bag-path-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BagPathTab implements AfterViewInit, OnDestroy {
  @ViewChild('bagMapEl') mapEl?: ElementRef<HTMLDivElement>;

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly service = inject(PilgrimsService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private leafletMap: any = null;

  userId = input.required<string>();

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly hasValidPathPoints = signal(false);
  readonly points = signal<BagLocationPoint[]>([]);

  ngAfterViewInit(): void {
    this.loadPath();
  }

  ngOnDestroy(): void {
    this.leafletMap?.remove();
    this.leafletMap = null;
  }

  private loadPath(): void {
    const lang = this.translate.currentLang || 'ar';
    this.loading.set(true);
    this.error.set(false);
    this.hasValidPathPoints.set(false);

    this.service
      .getLuggageLocationHistory(this.userId(), 1, 10, lang)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.loading.set(false);

          if (!res.IsSuccess) {
            this.error.set(true);
            return;
          }

          const items = res.Data?.Locations?.Items ?? [];
          const pts: BagLocationPoint[] = items
            .map((item, i) => ({
              id: item.Id,
              latitude: Number(item.Latitude),
              longitude: Number(item.Longitude),
              order: i + 1,
              timestamp: item.Timestamp,
              recordedAt: item.RecordedAt,
            }))
            .filter(p => this.isValidCoordinate(p.latitude, p.longitude))
            .sort((a, b) =>
              new Date(a.recordedAt || a.timestamp).getTime() -
              new Date(b.recordedAt || b.timestamp).getTime(),
            )
            .map((p, i) => ({ ...p, order: i + 1 }));

          this.points.set(pts);
          this.hasValidPathPoints.set(pts.length > 0);

          // Allow Angular to render the map container before initialising Leaflet
          setTimeout(() => void this.initMap(pts), 50);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
          this.points.set([]);
          this.hasValidPathPoints.set(false);
        },
      });
  }

  private isValidCoordinate(latitude: number, longitude: number): boolean {
    return Number.isFinite(latitude)
      && Number.isFinite(longitude)
      && latitude >= -90
      && latitude <= 90
      && longitude >= -180
      && longitude <= 180
      && (latitude !== 0 || longitude !== 0);
  }

  private async initMap(pts: BagLocationPoint[]): Promise<void> {
    if (!this.isBrowser || !this.mapEl?.nativeElement) return;

    const L = await loadLeaflet();
    delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
      iconUrl:       'assets/leaflet/marker-icon.png',
      shadowUrl:     'assets/leaflet/marker-shadow.png',
    });

    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
    }

    const map = L.map(this.mapEl.nativeElement, {
      zoomControl:     true,
      dragging:        true,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:     19,
      attribution: '© OpenStreetMap',
    }).addTo(map);

    if (pts.length === 0) {
      map.setView([21.4225, 39.8262], 12);
      this.leafletMap = map;
      setTimeout(() => map.invalidateSize(), 150);
      return;
    }

    pts.forEach(pt => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:28px;height:28px;border-radius:50%;background:#22c35d;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,.35)">${pt.order}</div>`,
        iconSize:   [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([pt.latitude, pt.longitude], { icon }).addTo(map);
    });

    const latlngs = pts.map(p => [p.latitude, p.longitude] as [number, number]);
    L.polyline(latlngs, { color: '#22c35d', weight: 3 }).addTo(map);

    if (pts.length === 1) {
      map.setView([pts[0].latitude, pts[0].longitude], 15);
    } else {
      map.fitBounds(latlngs);
    }

    this.leafletMap = map;
    setTimeout(() => map.invalidateSize(), 150);
  }
}
