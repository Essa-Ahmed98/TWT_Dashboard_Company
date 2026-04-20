import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PilgrimDetailData } from '../../pilgrim-detail.model';

@Component({
  selector: 'app-log-tab',
  imports: [],
  templateUrl: './log-tab.html',
  styleUrl: './log-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogTab {
  pilgrim = input.required<PilgrimDetailData>();
}
