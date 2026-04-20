import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SupervisorDetailData } from '../../supervisor-detail.model';

@Component({
  selector: 'app-sv-log-tab',
  imports: [],
  templateUrl: './log-tab.html',
  styleUrl: './log-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvLogTab {
  supervisor = input.required<SupervisorDetailData>();
}
