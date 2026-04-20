import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SupervisorDetailData } from '../../supervisor-detail.model';

@Component({
  selector: 'app-sv-personal-tab',
  imports: [],
  templateUrl: './personal-tab.html',
  styleUrl: './personal-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvPersonalTab {
  supervisor = input.required<SupervisorDetailData>();
}
