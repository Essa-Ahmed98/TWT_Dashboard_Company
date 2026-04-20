import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SupervisorDetailData } from '../../supervisor-detail.model';

@Component({
  selector: 'app-sv-performance-tab',
  imports: [],
  templateUrl: './performance-tab.html',
  styleUrl: './performance-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvPerformanceTab {
  supervisor = input.required<SupervisorDetailData>();

  filledStars(n: number): number[] { return Array.from({ length: Math.round(n) }); }
}
