import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { MessageService } from 'primeng/api';
import { PilgrimsService } from '../pilgrims.service';
import { PilgrimDetailData, STATUS_LABEL, pilgrimApiToDetailData } from '../pilgrim-detail/pilgrim-detail.model';
import { PersonalTab } from '../pilgrim-detail/tabs/personal-tab/personal-tab';
import { SupervisorsTab } from '../pilgrim-detail/tabs/supervisors-tab/supervisors-tab';
import { BagPathTab } from '../pilgrim-detail/tabs/bag-path-tab/bag-path-tab';

interface PilgrimProfileState {
  loading: boolean;
  data: PilgrimDetailData | null;
}

const INITIAL_PROFILE_STATE: PilgrimProfileState = {
  loading: true,
  data: null,
};

@Component({
  selector: 'app-pilgrim-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, PersonalTab, SupervisorsTab, BagPathTab],
  templateUrl: './pilgrim-profile.html',
  styleUrl: './pilgrim-profile.scss',
})
export class PilgrimProfile {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(PilgrimsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);

  readonly statusLabel = STATUS_LABEL;
  readonly detailState = signal<PilgrimProfileState>(INITIAL_PROFILE_STATE);
  readonly pilgrim = computed(() => this.detailState().data);
  readonly showAccommodationLoading = signal(false);
  readonly activeTab = signal<'personal' | 'supervisors' | 'bag-path'>('personal');

  readonly tabs: { key: 'personal' | 'supervisors' | 'bag-path'; labelKey: string; icon: string }[] = [
    { key: 'personal', labelKey: 'PILGRIMS_PROFILE.PERSONAL_DATA', icon: 'pi pi-user' },
    { key: 'supervisors', labelKey: 'PILGRIMS_PROFILE.SUPERVISORS_DATA', icon: 'pi pi-user-edit' },
    { key: 'bag-path', labelKey: 'PILGRIM_DETAIL.TABS.BAG_PATH', icon: 'pi pi-briefcase' },
  ];

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap(params => {
          const id = params.get('id');
          if (!id) return of({ loading: false, data: null });

          return this.service.getPilgrimById(id).pipe(
            map(res => ({
              loading: false,
              data: res.IsSuccess ? pilgrimApiToDetailData(res.Data) : null,
            })),
            catchError(() => of({ loading: false, data: null })),
            startWith(INITIAL_PROFILE_STATE),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(state => this.detailState.set(state));
  }

  showAccommodation(): void {
    const pilgrim = this.pilgrim();
    if (!pilgrim || this.showAccommodationLoading()) return;

    this.showAccommodationLoading.set(true);

    this.service.getAccommodationMapUrl(pilgrim.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.showAccommodationLoading.set(false);

          const url = typeof res.Data === 'string' ? res.Data.trim() : '';
          if (res.IsSuccess && url) {
            window.location.assign(url);
            return;
          }

          this.toast.add({
            severity: 'warn',
            summary: this.translate.instant('COMMON.WARNING'),
            detail: this.translate.instant('PILGRIMS_PROFILE.ACCOMMODATION_NOT_SET'),
            life: 3000,
          });
        },
        error: () => {
          this.showAccommodationLoading.set(false);
          this.toast.add({
            severity: 'error',
            summary: this.translate.instant('COMMON.ERROR'),
            detail: this.translate.instant('PILGRIMS_PROFILE.ACCOMMODATION_OPEN_ERROR'),
            life: 4000,
          });
        },
      });
  }
}
