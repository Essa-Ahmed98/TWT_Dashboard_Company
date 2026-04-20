import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { PilgrimRitualApiItem } from '../../../pilgrims.model';
import { PilgrimsService } from '../../../pilgrims.service';
import { PilgrimDetailData } from '../../pilgrim-detail.model';

type RitualStepStatus = 'done' | 'current' | 'pending';

interface RitualStepView {
  id: string;
  name: string;
  description: string;
  date: string;
  rawStatus: number;
  status: RitualStepStatus;
}

interface RitualSummaryView {
  currentRitualName: string;
  hajjType: string;
  progressText: string;
  completionText: string;
}

@Component({
  selector: 'app-rituals-tab',
  imports: [],
  templateUrl: './rituals-tab.html',
  styleUrl: './rituals-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RitualsTab {
  private readonly service = inject(PilgrimsService);
  private readonly destroyRef = inject(DestroyRef);

  pilgrim = input.required<PilgrimDetailData>();

  readonly loading = signal(true);
  readonly summary = signal<RitualSummaryView | null>(null);
  readonly rituals = signal<RitualStepView[]>([]);
  readonly hasItems = computed(() => this.rituals().length > 0);

  constructor() {
    toObservable(this.pilgrim)
      .pipe(
        switchMap(pilgrim => {
          if (!pilgrim.userId) {
            return of({
              loading: false,
              summary: null,
              rituals: [] as RitualStepView[],
            });
          }

          return this.service.getRitualsByUserId(pilgrim.userId).pipe(
            map(res => {
              if (!res.IsSuccess || !res.Data) {
                return {
                  loading: false,
                  summary: null,
                  rituals: [] as RitualStepView[],
                };
              }

              const rituals = this.mapRituals(res.Data.Rituals ?? [], res.Data.CompletedRituals);
              const currentRitual = rituals.find(step => step.status === 'current');

              return {
                loading: false,
                summary: {
                  currentRitualName: currentRitual?.name || 'لا يوجد منسك حالي',
                  hajjType: this.hajjTypeLabel(res.Data.HajjType),
                  progressText: `${this.clampPercent(res.Data.CompletionPercentage)}%`,
                  completionText: `${res.Data.CompletedRituals} من ${res.Data.TotalRituals}`,
                },
                rituals,
              };
            }),
            catchError(() => of({
              loading: false,
              summary: null,
              rituals: [] as RitualStepView[],
            })),
            startWith({
              loading: true,
              summary: null,
              rituals: [] as RitualStepView[],
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(state => {
        this.loading.set(state.loading);
        this.summary.set(state.summary);
        this.rituals.set(state.rituals);
      });
  }

  statusLabel(status: RitualStepStatus): string {
    const labels: Record<RitualStepStatus, string> = {
      done: 'مكتمل',
      current: 'جاري الآن',
      pending: 'قادم',
    };

    return labels[status];
  }

  private mapRituals(items: PilgrimRitualApiItem[], completedCount: number): RitualStepView[] {
    const rituals = [...items].sort((a, b) => a.Order - b.Order);
    const currentIndex = rituals.findIndex(item => item.IsCurrent);

    return rituals.map((item, index) => ({
      id: item.Id || `${item.Order}-${index}`,
      name: item.Name || `منسك ${item.Order || index + 1}`,
      description: item.ShortDescription || 'لا يوجد وصف متاح',
      date: this.formatHijriDate(item.HijriDay, item.HijriMonth),
      rawStatus: item.Status,
      status: this.resolveStepStatus(index, currentIndex, completedCount, item.Status, item.IsCurrent),
    }));
  }

  private resolveStepStatus(
    index: number,
    currentIndex: number,
    completedCount: number,
    rawStatus: number,
    isCurrent: boolean,
  ): RitualStepStatus {
    if (isCurrent) return 'current';
    if (currentIndex >= 0) return index < currentIndex ? 'done' : 'pending';
    if (completedCount > index) return 'done';
    if (rawStatus > 0) return 'done';
    return 'pending';
  }

  private formatHijriDate(day: number, month: number): string {
    const monthLabel = this.hijriMonthLabel(month);
    if (!day && !monthLabel) return 'التاريخ غير متاح';
    if (!monthLabel) return `اليوم ${day}`;
    if (!day) return monthLabel;
    return `${day} ${monthLabel}`;
  }

  private hijriMonthLabel(value: number): string {
    const months: Record<number, string> = {
      1: 'محرم',
      2: 'صفر',
      3: 'ربيع الأول',
      4: 'ربيع الآخر',
      5: 'جمادى الأولى',
      6: 'جمادى الآخرة',
      7: 'رجب',
      8: 'شعبان',
      9: 'رمضان',
      10: 'شوال',
      11: 'ذو القعدة',
      12: 'ذو الحجة',
    };

    return months[value] ?? '';
  }

  private hajjTypeLabel(value: number): string {
    const labels: Record<number, string> = {
      0: 'إفراد',
      1: 'قران',
      2: 'تمتع',
    };

    return labels[value] ?? `نوع ${value + 1}`;
  }

  private clampPercent(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
  }
}
