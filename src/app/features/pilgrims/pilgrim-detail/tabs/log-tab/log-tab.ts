import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { PilgrimDetailData } from '../../pilgrim-detail.model';

@Component({
  selector: 'app-log-tab',
  imports: [TranslateModule],
  templateUrl: './log-tab.html',
  styleUrl: './log-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogTab {
  pilgrim = input.required<PilgrimDetailData>();
}
