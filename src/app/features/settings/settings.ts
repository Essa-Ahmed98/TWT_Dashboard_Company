import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';
import { finalize } from 'rxjs/operators';
import { SettingsService } from './settings.service';
import { UpdateCompanySettingsRequest } from './settings.model';

interface FeatureRow {
  key: FeatureKey;
  title: string;
  description: string;
  enabled: boolean;
}

const FEATURE_META = {
  HealthEnabled:         { title: 'الصحة', description: 'إدارة البيانات الصحية للحجاج' },
  LocationEnabled:       { title: 'الموقع', description: 'تتبع موقع الحجاج على الخريطة' },
  DocumentsEnabled:      { title: 'المستندات', description: 'رفع وإدارة مستندات الحجاج' },
  RitualsEnabled:        { title: 'المناسك', description: 'متابعة شعائر الحج' },
  ReviewsEnabled:        { title: 'التقييمات', description: 'استعراض تقييمات الحجاج' },
  ComplaintsEnabled:     { title: 'الشكاوى', description: 'استقبال وإدارة الشكاوى' },
  TransportationEnabled: { title: 'النقل', description: 'إدارة وسائل نقل الحجاج' },
  CommunicationEnabled:  { title: 'التواصل', description: 'قنوات التواصل مع الحجاج' },
} satisfies Record<string, { title: string; description: string }>;

type FeatureKey = keyof typeof FEATURE_META;

const FEATURE_KEYS = Object.keys(FEATURE_META) as FeatureKey[];

@Component({
  selector: 'app-settings',
  imports: [],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings implements OnInit {
  private readonly settingsService = inject(SettingsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(MessageService);

  readonly loading = this.settingsService.loading;

  readonly features = signal<FeatureRow[]>([]);
  readonly saving = signal(false);

  constructor() {
    effect(() => {
      const settings = this.settingsService.settings();
      if (!settings) return;

      this.features.set(
        FEATURE_KEYS.map(key => ({
          key,
          title: FEATURE_META[key].title,
          description: FEATURE_META[key].description,
          enabled: settings[key],
        }))
      );
    });
  }

  ngOnInit(): void {
    this.settingsService.loadSettings();
  }

  toggleFeature(key: FeatureKey): void {
    this.features.update(list =>
      list.map(feature => feature.key === key ? { ...feature, enabled: !feature.enabled } : feature)
    );
  }

  saveSettings(): void {
    const payload = this.features().reduce((acc, feature) => {
      acc[feature.key] = feature.enabled;
      return acc;
    }, {} as Omit<UpdateCompanySettingsRequest, 'Icon'>);
    const currentSettings = this.settingsService.settings();

    const request = this.settingsService.updateSettings(payload);
    if (!request) {
      this.toast.add({
        severity: 'error',
        summary: 'خطأ',
        detail: 'تعذر تحديد الشركة الحالية',
      });
      return;
    }

    this.saving.set(true);
    request
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: res => {
          if (!res.IsSuccess) {
            this.toast.add({
              severity: 'error',
              summary: 'خطأ',
              detail: 'تعذر حفظ الإعدادات',
            });
            return;
          }

          this.toast.add({
            severity: 'success',
            summary: 'نجاح',
            detail: 'تم حفظ الإعدادات بنجاح',
          });

          if (res.Data) {
            this.settingsService.setSettings(res.Data);
            return;
          }

          if (currentSettings) {
            this.settingsService.setSettings({
              ...currentSettings,
              ...payload,
            });
          }
        },
      });
  }
}
