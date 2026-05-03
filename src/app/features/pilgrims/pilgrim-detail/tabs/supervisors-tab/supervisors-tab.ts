import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PilgrimDetailData } from '../../pilgrim-detail.model';

@Component({
  selector: 'app-supervisors-tab',
  imports: [],
  templateUrl: './supervisors-tab.html',
  styleUrl: './supervisors-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupervisorsTab {
  pilgrim = input.required<PilgrimDetailData>();
}
