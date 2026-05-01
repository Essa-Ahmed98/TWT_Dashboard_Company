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
import { PilgrimDetailData } from '../../pilgrim-detail.model';
import { loadLeaflet } from '../../../../../shared/utils/leaflet-loader';

@Component({
  selector: 'app-personal-tab',
  imports: [],
  templateUrl: './personal-tab.html',
  styleUrl: './personal-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonalTab implements AfterViewInit, OnDestroy {
  @ViewChild('accommodationMapEl') mapEl?: ElementRef<HTMLDivElement>;

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private leafletMap: any = null;

  pilgrim      = input.required<PilgrimDetailData>();
  isEditing    = input<boolean>(false);
  editData     = input<PilgrimDetailData | null>(null);
  fieldChanged = output<Partial<PilgrimDetailData>>();

  ngAfterViewInit(): void {
    const { accommodationLat: lat, accommodationLng: lng } = this.pilgrim();
    if (lat != null && lng != null) {
      void this.initMap(lat, lng);
    }
  }

  ngOnDestroy(): void {
    this.leafletMap?.remove();
    this.leafletMap = null;
  }

  private async initMap(lat: number, lng: number): Promise<void> {
    if (!this.isBrowser || !this.mapEl?.nativeElement) return;

    const L = await loadLeaflet();
    delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
      iconUrl:       'assets/leaflet/marker-icon.png',
      shadowUrl:     'assets/leaflet/marker-shadow.png',
    });

    const map = L.map(this.mapEl.nativeElement, {
      center:          [lat, lng],
      zoom:            15,
      zoomControl:     true,
      dragging:        true,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:     19,
      attribution: '© OpenStreetMap',
    }).addTo(map);

    L.marker([lat, lng]).addTo(map);
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
