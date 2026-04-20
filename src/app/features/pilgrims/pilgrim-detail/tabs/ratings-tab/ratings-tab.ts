import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { PilgrimsService } from '../../../pilgrims.service';
import { PilgrimDetailData } from '../../pilgrim-detail.model';

interface ReviewView {
  id: string;
  category: string;
  stars: number;
  comment: string;
  date: string;
}

@Component({
  selector: 'app-ratings-tab',
  imports: [],
  templateUrl: './ratings-tab.html',
  styleUrl: './ratings-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RatingsTab {
  private readonly service = inject(PilgrimsService);
  private readonly destroyRef = inject(DestroyRef);

  pilgrim = input.required<PilgrimDetailData>();

  readonly loading = signal(true);
  readonly ratings = signal<ReviewView[]>([]);
  readonly hasItems = computed(() => this.ratings().length > 0);

  constructor() {
    toObservable(this.pilgrim)
      .pipe(
        switchMap(pilgrim => {
          if (!pilgrim.userId) {
            return of({ loading: false, items: [] as ReviewView[] });
          }

          return this.service.getReviewsByUserId(pilgrim.userId).pipe(
            map(res => ({
              loading: false,
              items: res.IsSuccess
                ? res.Data.map(review => ({
                    id: review.Id,
                    category: this.categoryLabel(review.Category),
                    stars: review.Rating,
                    comment: review.Comment,
                    date: this.formatDate(review.CreatedAt),
                  }))
                : [],
            })),
            catchError(() => of({ loading: false, items: [] })),
            startWith({ loading: true, items: [] }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(state => {
        this.loading.set(state.loading);
        this.ratings.set(state.items);
      });
  }

  filledStars(n: number): number[] {
    return Array.from({ length: Math.max(0, Math.min(5, n)) });
  }

  emptyStars(n: number): number[] {
    return Array.from({ length: Math.max(0, 5 - Math.max(0, Math.min(5, n))) });
  }

  private categoryLabel(value: number): string {
    const categories: Record<number, string> = {
      0: 'التعامل',
      1: 'الخدمة',
      2: 'التنظيم',
      3: 'المتابعة',
      4: 'عام',
    };

    return categories[value] ?? `تصنيف ${value + 1}`;
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
}
