import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { PilgrimsService } from '../../../pilgrims.service';
import { PilgrimDetailData } from '../../pilgrim-detail.model';

interface FamilyMemberView {
  name: string;
  phone: string;
  email: string;
  relation: string;
}

@Component({
  selector: 'app-family-tab',
  imports: [],
  templateUrl: './family-tab.html',
  styleUrl: './family-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FamilyTab {
  private readonly service = inject(PilgrimsService);
  private readonly destroyRef = inject(DestroyRef);

  pilgrim = input.required<PilgrimDetailData>();

  readonly loading = signal(true);
  readonly family = signal<FamilyMemberView[]>([]);
  readonly hasItems = computed(() => this.family().length > 0);

  constructor() {
    toObservable(this.pilgrim)
      .pipe(
        switchMap(pilgrim =>
          this.service.getPilgrimFamily(pilgrim.id).pipe(
            map(res => ({
              loading: false,
              items: res.IsSuccess
                ? res.Data.map(member => ({
                    name: member.Name,
                    phone: member.Phone,
                    email: member.Email,
                    relation: '',
                  }))
                : [],
            })),
            catchError(() => of({ loading: false, items: [] })),
            startWith({ loading: true, items: [] }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(state => {
        this.loading.set(state.loading);
        this.family.set(state.items);
      });
  }
}
