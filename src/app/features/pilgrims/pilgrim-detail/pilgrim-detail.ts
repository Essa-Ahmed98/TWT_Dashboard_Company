import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ApiResult } from '../../../core/models/api.models';
import { PilgrimsService } from '../pilgrims.service';
import { PilgrimDetailData, PilgrimTab, STATUS_LABEL, pilgrimApiToDetailData } from './pilgrim-detail.model';
import { PersonalTab } from './tabs/personal-tab/personal-tab';
import { HealthTab } from './tabs/health-tab/health-tab';
import { RitualsTab } from './tabs/rituals-tab/rituals-tab';
import { FamilyTab } from './tabs/family-tab/family-tab';
import { SupervisorsTab } from './tabs/supervisors-tab/supervisors-tab';
import { RatingsTab } from './tabs/ratings-tab/ratings-tab';

interface PilgrimDetailState {
  loading: boolean;
  data: PilgrimDetailData | null;
}

const INITIAL_DETAIL_STATE: PilgrimDetailState = {
  loading: true,
  data: null,
};

@Component({
  selector: 'app-pilgrim-detail',
  imports: [PersonalTab, HealthTab, RitualsTab, FamilyTab, SupervisorsTab, RatingsTab],
  templateUrl: './pilgrim-detail.html',
  styleUrl: './pilgrim-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PilgrimDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(PilgrimsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(MessageService);

  activeTab = signal<PilgrimTab>('personal');
  isEditing = signal(false);
  saving = signal(false);
  editData = signal<PilgrimDetailData | null>(null);
  private readonly savedData = signal<PilgrimDetailData | null>(null);

  statusLabel = STATUS_LABEL;

  tabs: { key: PilgrimTab; label: string; icon: string }[] = [
    { key: 'personal', label: 'البيانات الشخصية', icon: 'pi pi-user' },
    { key: 'supervisors', label: 'بيانات المشرفين', icon: 'pi pi-user-edit' },
    { key: 'health', label: 'الصحة والأدوية', icon: 'pi pi-heart' },
    { key: 'rituals', label: 'المناسك', icon: 'pi pi-map-marker' },
    { key: 'family', label: 'العائلة', icon: 'pi pi-users' },
    { key: 'ratings', label: 'التقييمات', icon: 'pi pi-star' },
  ];

  readonly detailState = signal<PilgrimDetailState>(INITIAL_DETAIL_STATE);
  readonly pilgrim = computed<PilgrimDetailData | null>(() => this.savedData() ?? this.detailState().data);

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap(params => {
          const id = params.get('id');
          if (!id) {
            return of({ loading: false, data: null });
          }

          return this.service.getPilgrimById(id).pipe(
            map(res => ({
              loading: false,
              data: res.IsSuccess ? pilgrimApiToDetailData(res.Data) : null,
            })),
            catchError(() => of({ loading: false, data: null })),
            startWith(INITIAL_DETAIL_STATE),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(state => this.detailState.set(state));

    effect(() => {
      this.detailState();
      this.savedData.set(null);
      this.editData.set(null);
      this.isEditing.set(false);
    }, { allowSignalWrites: true });
  }

  goBack(): void {
    this.router.navigate(['/pilgrims']);
  }

  openChat(userId: string, displayName?: string): void {
    this.router.navigate(['/chat'], { queryParams: { userId }, state: { displayName } });
  }

  startEditing(): void {
    const pilgrim = this.pilgrim();
    if (!pilgrim) return;

    this.editData.set({ ...pilgrim, emergencyContact: { ...pilgrim.emergencyContact } });
    this.isEditing.set(true);
  }

  cancelEditing(): void {
    this.isEditing.set(false);
    this.editData.set(null);
  }

  onFieldChanged(patch: Partial<PilgrimDetailData>): void {
    const current = this.editData();
    if (!current) return;

    this.editData.set({ ...current, ...patch });
  }

  saveEdit(): void {
    const data = this.editData();
    if (!data || this.saving()) return;

    this.saving.set(true);
    this.service.updatePilgrim({
      Id:              data.id,
      HajjType:        data.hajjType,
      PassportNumber:  data.passportNumber,
      Nationality:     data.nationality,
      DateOfBirth:     data.birthDate ? new Date(data.birthDate).toISOString() : '',
      Gender:          data.gender === 'أنثى' ? 1 : 0,
      IDNumber:        data.idNumber,
      Accommodation:   data.accommodation,
      NuskCardNumber:  data.nusukCard,
      PermitNumber:    data.permitNumber,
      BloodType:       data.bloodTypeValue,
      Email:           data.email,
      DisplayName:     data.name,
      Phone:           data.phone,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.saving.set(false);
          if (res.IsSuccess) {
            this.savedData.set(data);
            this.isEditing.set(false);
            this.editData.set(null);
            this.toast.add({
              severity: 'success',
              summary: 'تم التعديل',
              detail: 'تم تحديث بيانات الحاج بنجاح',
              life: 3000,
            });
          } else {
            this.toast.add({
              severity: 'error',
              summary: 'خطأ',
              detail: res.Error?.MessageKey || res.Error?.message || res.ValidationErrors?.[0]?.ErrorMessage || 'تعذر تحديث بيانات الحاج',
              life: 4000,
            });
          }
        },
        error: err => {
          this.saving.set(false);
          const body = err?.error as ApiResult<unknown> | undefined;
          this.toast.add({
            severity: 'error',
            summary: 'خطأ',
            detail: body?.Error?.MessageKey || body?.Error?.message || body?.ValidationErrors?.[0]?.ErrorMessage || 'حدث خطأ أثناء تحديث بيانات الحاج',
            life: 4000,
          });
        },
      });
  }
}
