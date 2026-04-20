import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { SupervisorsService } from '../../../supervisors.service';
import { SupervisorDetailData } from '../../supervisor-detail.model';

interface ReviewView {
  id: string;
  pilgrimName: string;
  pilgrimInitials: string;
  stars: number;
  label: string;
  comment: string;
  date: string;
}

interface RatingDistView {
  stars: number;
  pct: number;
  count: number;
}

interface RatingsSummaryView {
  averageRating: number;
  totalReviews: number;
  positiveCount: number;
  negativeCount: number;
  distribution: RatingDistView[];
}

@Component({
  selector: 'app-sv-ratings-tab',
  imports: [],
  templateUrl: './ratings-tab.html',
  styleUrl: './ratings-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvRatingsTab {
  private readonly service = inject(SupervisorsService);
  private readonly destroyRef = inject(DestroyRef);

  supervisor = input.required<SupervisorDetailData>();

  readonly loading = signal(true);
  readonly ratings = signal<ReviewView[]>([]);
  readonly summary = signal<RatingsSummaryView>({
    averageRating: 0,
    totalReviews: 0,
    positiveCount: 0,
    negativeCount: 0,
    distribution: [5, 4, 3, 2, 1].map(stars => ({ stars, pct: 0, count: 0 })),
  });
  readonly hasItems = computed(() => this.ratings().length > 0);

  constructor() {
    toObservable(this.supervisor)
      .pipe(
        switchMap(supervisor => {
          if (!supervisor.groupId) {
            return of({
              loading: false,
              ratings: [] as ReviewView[],
              summary: this.emptySummary(),
            });
          }

          return this.service.getSupervisorReviews(supervisor.groupId).pipe(
            map(res => {
              if (!res.IsSuccess) {
                return {
                  loading: false,
                  ratings: [] as ReviewView[],
                  summary: this.emptySummary(),
                };
              }

              const summary = res.Data.Ratings;
              const distributionMap = new Map(summary.Distribution.map(item => [item.Stars, item]));

              return {
                loading: false,
                ratings: res.Data.Reviews.Items.map(review => ({
                  id: review.Id,
                  pilgrimName: review.DisplayName || 'غير معروف',
                  pilgrimInitials: this.getInitials(review.DisplayName || 'غير معروف'),
                  stars: review.Rating,
                  label: this.categoryLabel(review.Category),
                  comment: review.Comment || 'لا يوجد تعليق',
                  date: this.formatDate(review.CreatedAt),
                })),
                summary: {
                  averageRating: summary.AverageRating,
                  totalReviews: summary.TotalReviews,
                  positiveCount: summary.PositiveCount,
                  negativeCount: summary.NegativeCount,
                  distribution: [5, 4, 3, 2, 1].map(stars => {
                    const item = distributionMap.get(stars);
                    return {
                      stars,
                      pct: item?.Percentage ?? 0,
                      count: item?.Count ?? 0,
                    };
                  }),
                },
              };
            }),
            catchError(() => of({
              loading: false,
              ratings: [] as ReviewView[],
              summary: this.emptySummary(),
            })),
            startWith({
              loading: true,
              ratings: [] as ReviewView[],
              summary: this.emptySummary(),
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(state => {
        this.loading.set(state.loading);
        this.ratings.set(state.ratings);
        this.summary.set(state.summary);
      });
  }

  filledStars(n: number): number[] {
    return Array.from({ length: Math.max(0, Math.min(5, Math.round(n))) });
  }

  emptyStars(n: number): number[] {
    return Array.from({ length: Math.max(0, 5 - Math.max(0, Math.min(5, Math.round(n)))) });
  }

  private emptySummary(): RatingsSummaryView {
    return {
      averageRating: 0,
      totalReviews: 0,
      positiveCount: 0,
      negativeCount: 0,
      distribution: [5, 4, 3, 2, 1].map(stars => ({ stars, pct: 0, count: 0 })),
    };
  }

  private categoryLabel(value: number): string {
    const categories: Record<number, string> = {
      0: 'المشرف',
      1: 'النقل',
      2: 'السكن',
      3: 'الطعام',
      4: 'الطبي',
      5: 'الإرشاد الديني',
      6: 'النظام',
      7: 'عام',
    };

    return categories[value] ?? `تصنيف ${value}`;
  }

  private formatDate(value: string): string {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  private getInitials(name: string): string {
    const parts = name
      .split(/\s+/)
      .map(part => part.trim())
      .filter(Boolean)
      .slice(0, 2);

    return parts.map(part => part[0]).join('') || name[0] || '؟';
  }
}
