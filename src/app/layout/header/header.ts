import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/services/auth';
import { TranslationService, SUPPORTED_LANGUAGES } from '../../core/services/translation.service';
import { SettingsService } from '../../features/settings/settings.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, TranslateModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  auth = inject(AuthService);
  translation = inject(TranslationService);
  settingsService = inject(SettingsService);
  toggleSidenav = output<void>();

  readonly languages = SUPPORTED_LANGUAGES;
  readonly langDropOpen = signal(false);

  private elRef = inject(ElementRef);

  constructor() {
    this.settingsService.loadSettings();
  }

  toggleLangDrop(): void {
    this.langDropOpen.update(v => !v);
  }

  selectLang(code: string): void {
    this.translation.setLanguage(code);
    this.langDropOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.langDropOpen.set(false);
    }
  }
}
