import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidenav } from '../sidenav/sidenav';
import { Header } from '../header/header';
import { CallOverlay } from '../../features/chat/call/call-overlay';
import { ChatService } from '../../features/chat/chat.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidenav, Header, CallOverlay],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell implements OnDestroy {
  private readonly chat = inject(ChatService);

  collapsed = signal(false);

  toggleSidenav() {
    this.collapsed.update(v => !v);
  }

  // Leaving the dashboard (logout): close the chat hub connection
  ngOnDestroy(): void {
    this.chat.disconnect();
  }
}
