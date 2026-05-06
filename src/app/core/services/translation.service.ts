import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export interface Language {
  code: string;
  label: string;
  dir: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'ru', label: 'Русский', dir: 'ltr' },
];

const LANG_STORAGE_KEY = 'appLang';
const DEFAULT_LANG = 'en';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private translate = inject(TranslateService);

  readonly currentLang = signal<string>(DEFAULT_LANG);
  readonly supportedLanguages = SUPPORTED_LANGUAGES;

  init(): void {
    const saved = this.getSavedLang();
    this.applyLanguage(saved);
  }

  setLanguage(code: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LANG_STORAGE_KEY, code);
    }
    this.applyLanguage(code);
  }

  getCurrentLanguage(): Language {
    return SUPPORTED_LANGUAGES.find(l => l.code === this.currentLang()) ?? SUPPORTED_LANGUAGES[1];
  }

  private applyLanguage(code: string): void {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === code) ?? SUPPORTED_LANGUAGES[1];
    this.translate.use(lang.code);
    this.currentLang.set(lang.code);
    if (typeof document !== 'undefined') {
      document.documentElement.dir = lang.dir;
      document.documentElement.lang = lang.code;
    }
  }

  private getSavedLang(): string {
    if (typeof localStorage === 'undefined') return DEFAULT_LANG;
    return localStorage.getItem(LANG_STORAGE_KEY) ?? DEFAULT_LANG;
  }
}
