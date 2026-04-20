import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PilgrimDetailData } from '../../pilgrim-detail.model';
import { PilgrimsService } from '../../../pilgrims.service';
import { DrugApiItem } from '../../../pilgrims.model';

@Component({
  selector: 'app-health-tab',
  imports: [],
  templateUrl: './health-tab.html',
  styleUrl: './health-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthTab implements OnInit {
  pilgrim = input.required<PilgrimDetailData>();

  private readonly service    = inject(PilgrimsService);
  private readonly destroyRef = inject(DestroyRef);

  drugs        = signal<DrugApiItem[]>([]);
  loadingDrugs = signal(false);

  ngOnInit(): void {
    const userId = this.pilgrim().userId;
    if (!userId) return;

    this.loadingDrugs.set(true);
    this.service.getDrugsByUserId(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (res.IsSuccess) this.drugs.set(res.Data);
          this.loadingDrugs.set(false);
        },
        error: () => this.loadingDrugs.set(false),
      });
  }
}
