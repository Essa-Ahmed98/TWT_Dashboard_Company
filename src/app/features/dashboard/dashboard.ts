import { ChangeDetectionStrategy, Component, OnInit, inject, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { DashboardService } from './dashboard.service';

export interface DonutSegment {
  label: string;
  count: number;
  color: string;
  path: string;
  pct: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnInit {
  readonly svc = inject(DashboardService);

  readonly hijriYear = new Intl.DateTimeFormat('ar', {
    calendar: 'islamic-umalqura',
    year: 'numeric',
  }).formatToParts(new Date()).find(p => p.type === 'year')?.value ?? '';

  readonly hoveredSegment = signal<DonutSegment | null>(null);

  readonly donutData = computed(() => {
    const h = this.svc.health();
    if (!h) return null;

    const total = (h.StableCount + h.WarningCount + h.CriticalCount) || 1;
    const items = [
      { label: 'مستقر',        count: h.StableCount,   color: '#22c35d' },
      { label: 'يحتاج متابعة', count: h.WarningCount,  color: '#fb8c00' },
      { label: 'حرج',          count: h.CriticalCount, color: '#e53935' },
    ];

    let angle = 0;
    const segments: DonutSegment[] = items.map(item => {
      const sweep = (item.count / total) * 360;
      const path  = item.count > 0 ? this.arcPath(60, 60, 54, 40, angle, angle + sweep) : '';
      angle += sweep;
      return { ...item, path, pct: Math.round((item.count / total) * 100) };
    });

    return { segments, pilgrims: h.PilgrimsCount, total };
  });

  ngOnInit(): void {
    this.svc.load();
    this.svc.loadHealth();
  }

  private arcPath(cx: number, cy: number, rOut: number, rIn: number, start: number, end: number): string {
    if (end - start >= 360) end = start + 359.99;
    const large = end - start > 180 ? 1 : 0;
    const [ox1, oy1] = this.polar(cx, cy, rOut, start);
    const [ox2, oy2] = this.polar(cx, cy, rOut, end);
    const [ix1, iy1] = this.polar(cx, cy, rIn, end);
    const [ix2, iy2] = this.polar(cx, cy, rIn, start);
    return `M ${ox1},${oy1} A ${rOut},${rOut} 0 ${large} 1 ${ox2},${oy2} L ${ix1},${iy1} A ${rIn},${rIn} 0 ${large} 0 ${ix2},${iy2} Z`;
  }

  private polar(cx: number, cy: number, r: number, deg: number): [number, number] {
    const rad = (deg - 90) * Math.PI / 180;
    return [+(cx + r * Math.cos(rad)).toFixed(3), +(cy + r * Math.sin(rad)).toFixed(3)];
  }
}
