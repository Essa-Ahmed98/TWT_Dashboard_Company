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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { finalize } from 'rxjs/operators';
import { SettingsService } from './settings.service';
import { UpdateCompanySettingsRequest } from './settings.model';

interface FeatureRow {
  key: FeatureKey;
  titleKey: string;
  descriptionKey: string;
  enabled: boolean;
}

const FEATURE_META = {
  HealthEnabled:         { titleKey: 'SETTINGS.FEATURES.HEALTH.TITLE', descriptionKey: 'SETTINGS.FEATURES.HEALTH.DESC' },
  LocationEnabled:       { titleKey: 'SETTINGS.FEATURES.LOCATION.TITLE', descriptionKey: 'SETTINGS.FEATURES.LOCATION.DESC' },
  DocumentsEnabled:      { titleKey: 'SETTINGS.FEATURES.DOCUMENTS.TITLE', descriptionKey: 'SETTINGS.FEATURES.DOCUMENTS.DESC' },
  RitualsEnabled:        { titleKey: 'SETTINGS.FEATURES.RITUALS.TITLE', descriptionKey: 'SETTINGS.FEATURES.RITUALS.DESC' },
  ReviewsEnabled:        { titleKey: 'SETTINGS.FEATURES.REVIEWS.TITLE', descriptionKey: 'SETTINGS.FEATURES.REVIEWS.DESC' },
  ComplaintsEnabled:     { titleKey: 'SETTINGS.FEATURES.COMPLAINTS.TITLE', descriptionKey: 'SETTINGS.FEATURES.COMPLAINTS.DESC' },
  TransportationEnabled: { titleKey: 'SETTINGS.FEATURES.TRANSPORTATION.TITLE', descriptionKey: 'SETTINGS.FEATURES.TRANSPORTATION.DESC' },
  CommunicationEnabled:  { titleKey: 'SETTINGS.FEATURES.COMMUNICATION.TITLE', descriptionKey: 'SETTINGS.FEATURES.COMMUNICATION.DESC' },
} satisfies Record<string, { titleKey: string; descriptionKey: string }>;

type FeatureKey = keyof typeof FEATURE_META;

const FEATURE_KEYS = Object.keys(FEATURE_META) as FeatureKey[];

@Component({
  selector: 'app-settings',
  host: { 'data-component': 'settings-page' },
  imports: [TranslateModule, ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings implements OnInit {
  private readonly settingsService = inject(SettingsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);

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
          titleKey: FEATURE_META[key].titleKey,
          descriptionKey: FEATURE_META[key].descriptionKey,
          enabled: settings[key],
        }))
      );

      if (!this.selectedIcon()) {
        this.iconPreviewUrl.set(this.settingsService.iconUrl());
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
        summary: this.translate.instant('COMMON.INVALID_FILE'),
        detail: this.translate.instant('COMMON.INVALID_IMAGE'),
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
    this.iconPreviewUrl.set(this.settingsService.iconUrl());
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
        summary: this.translate.instant('COMMON.ERROR'),
        detail: this.translate.instant('SETTINGS.COMPANY_MISSING'),
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
              summary: this.translate.instant('COMMON.ERROR'),
              detail: this.translate.instant('SETTINGS.SAVE_ERROR'),
            });
            return;
          }

          this.toast.add({
            severity: 'success',
            summary: this.translate.instant('COMMON.SUCCESS'),
            detail: this.translate.instant('SETTINGS.SAVED_SUCCESS'),
          });

          this.selectedIcon.set(null);
          this.revokeObjectIconUrl();

          if (res.Data) {
            this.settingsService.setSettings(res.Data);
            this.iconPreviewUrl.set(this.settingsService.iconUrl());
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

  private revokeObjectIconUrl(): void {
    if (!this.objectIconUrl) return;
    URL.revokeObjectURL(this.objectIconUrl);
    this.objectIconUrl = null;
  }
}
