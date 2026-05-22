import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject,
  input,
  output,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PilgrimDetailData } from '../../pilgrim-detail.model';
import { loadLeaflet } from '../../../../../shared/utils/leaflet-loader';

@Component({
  selector: 'app-personal-tab',
  imports: [TranslateModule, ],
  templateUrl: './personal-tab.html',
  styleUrl: './personal-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonalTab implements AfterViewInit, OnDestroy {
  @ViewChild('currentLocationMapEl') mapEl?: ElementRef<HTMLDivElement>;

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly translate = inject(TranslateService);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private leafletMap: any = null;

  pilgrim      = input.required<PilgrimDetailData>();
  isEditing    = input<boolean>(false);
  editData     = input<PilgrimDetailData | null>(null);
  fieldChanged = output<Partial<PilgrimDetailData>>();

  ngAfterViewInit(): void {
    const p = this.pilgrim();
    const current = p.currentLocation;
    const accommodation = p.accommodationLat != null && p.accommodationLng != null
      ? { lat: p.accommodationLat, lng: p.accommodationLng }
      : null;

    if (current || accommodation) {
      void this.initMap(current, accommodation);
    }
  }

  ngOnDestroy(): void {
    this.leafletMap?.remove();
    this.leafletMap = null;
  }

  private async initMap(
    current: { lat: number; lng: number } | null,
    accommodation: { lat: number; lng: number } | null,
  ): Promise<void> {
    if (!this.isBrowser || !this.mapEl?.nativeElement) return;

    const L = await loadLeaflet();

    const center = current ?? accommodation!;
    const map = L.map(this.mapEl.nativeElement, {
      center:          [center.lat, center.lng],
      zoom:            15,
      zoomControl:     true,
      dragging:        true,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:     19,
      attribution: '© OpenStreetMap',
    }).addTo(map);

    const buildIcon = (color: string, glyph: string) => L.divIcon({
      className: 'pilgrim-map-marker',
      html: `<div class="pilgrim-map-marker__pin" style="background:${color}"><i class="pi ${glyph}"></i></div>`,
      iconSize:   [34, 42],
      iconAnchor: [17, 40],
      popupAnchor: [0, -36],
    });

    const markers = [];
    if (current) {
      markers.push(
        L.marker([current.lat, current.lng], { icon: buildIcon('#22c35d', 'pi-map-marker') })
          .addTo(map)
          .bindTooltip(this.translate.instant('PILGRIM_DETAIL.PERSONAL.CURRENT_LOCATION')),
      );
    }
    if (accommodation) {
      markers.push(
        L.marker([accommodation.lat, accommodation.lng], { icon: buildIcon('#0b405b', 'pi-home') })
          .addTo(map)
          .bindTooltip(this.translate.instant('PILGRIM_DETAIL.PERSONAL.ACCOMMODATION')),
      );
    }

    if (markers.length === 2) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.3));
    }

    this.leafletMap = map;
    setTimeout(() => map.invalidateSize(), 150);
  }

  patchEmergency(field: 'name' | 'phone', value: string): void {
    const current = this.editData();
    if (!current) return;
    this.fieldChanged.emit({
      emergencyContact: { ...current.emergencyContact, [field]: value },
    });
  }
}
