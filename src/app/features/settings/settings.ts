import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
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
  host: { 'data-component': 'settings-page' },
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
  readonly selectedIcon = signal<File | null>(null);
  readonly iconPreviewUrl = signal('');
  readonly iconFileName = computed(() => this.selectedIcon()?.name ?? '');

  private objectIconUrl: string | null = null;

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

      if (!this.selectedIcon()) {
        this.iconPreviewUrl.set(this.resolveIconUrl(settings.IconPath));
      }
    });

    this.destroyRef.onDestroy(() => this.revokeObjectIconUrl());
  }

  ngOnInit(): void {
    this.settingsService.loadSettings();
  }

  toggleFeature(key: FeatureKey): void {
    this.features.update(list =>
      list.map(feature => feature.key === key ? { ...feature, enabled: !feature.enabled } : feature)
    );
  }

  onIconSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toast.add({
        severity: 'warn',
        summary: 'ملف غير مناسب',
        detail: 'من فضلك اختر صورة صالحة',
      });
      input.value = '';
      return;
    }

    this.revokeObjectIconUrl();
    this.objectIconUrl = URL.createObjectURL(file);
    this.selectedIcon.set(file);
    this.iconPreviewUrl.set(this.objectIconUrl);
  }

  clearSelectedIcon(input?: HTMLInputElement): void {
    this.selectedIcon.set(null);
    this.revokeObjectIconUrl();
    this.iconPreviewUrl.set(this.resolveIconUrl(this.settingsService.settings()?.IconPath));
    if (input) input.value = '';
  }

  saveSettings(): void {
    const payload = this.features().reduce((acc, feature) => {
      acc[feature.key] = feature.enabled;
      return acc;
    }, {} as Omit<UpdateCompanySettingsRequest, 'Icon'>);
    const currentSettings = this.settingsService.settings();

    const request = this.settingsService.updateSettings({
      ...payload,
      Icon: this.selectedIcon(),
    });
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

          this.selectedIcon.set(null);
          this.revokeObjectIconUrl();

          if (res.Data) {
            this.iconPreviewUrl.set(this.resolveIconUrl(res.Data.IconPath));
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

  private resolveIconUrl(path?: string | null): string {
    return path?.trim() ?? '';
  }

  private revokeObjectIconUrl(): void {
    if (!this.objectIconUrl) return;
    URL.revokeObjectURL(this.objectIconUrl);
    this.objectIconUrl = null;
  }
}
