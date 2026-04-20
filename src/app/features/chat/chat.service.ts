import { Injectable, inject, PLATFORM_ID, NgZone, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/services/auth';
import { ApiResult } from '../../core/models/api.models';
import {
  ConversationResult,
  MessageResult,
  MessagesPageResult,
  MessagesReadNotification,
  OpenConversationResult,
  PilgrimSearchResult,
  UnreadCountResult,
} from './chat.model';

@Injectable({ providedIn: 'root' })
export class ChatService implements OnDestroy {
  private readonly http      = inject(HttpClient);
  private readonly auth      = inject(AuthService);
  private readonly zone      = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private hub: any = null;

  // ── SignalR event streams ────────────────────────────────────────
  readonly receiveMessage$ = new Subject<MessageResult>();
  readonly messagesRead$   = new Subject<MessagesReadNotification>();
  readonly friendOnline$   = new Subject<string>();
  readonly friendOffline$  = new Subject<string>();
  readonly connected$      = new Subject<boolean>();

  // ── REST API ─────────────────────────────────────────────────────

  getConversations() {
    return this.http.get<ApiResult<ConversationResult[]>>(
      `${environment.chatApiBase}/chat/conversations`,
    );
  }

  openConversation(friendId: string) {
    return this.http.get<ApiResult<OpenConversationResult>>(
      `${environment.chatApiBase}/chat/open/${friendId}`,
    );
  }

  getMessages(conversationId: string, before?: string, limit = 30) {
    let url = `${environment.chatApiBase}/chat/${conversationId}/messages?limit=${limit}`;
    if (before) url += `&before=${before}`;
    return this.http.get<ApiResult<MessagesPageResult>>(url);
  }

  searchPilgrims(query: string) {
    return this.http.get<ApiResult<PilgrimSearchResult[]>>(
      `${environment.chatApiBase}/chat/search-pilgrims?search=${encodeURIComponent(query)}`,
    );
  }

  getUnreadCount() {
    return this.http.get<ApiResult<UnreadCountResult>>(
      `${environment.chatApiBase}/chat/unread-count`,
    );
  }

  // ── SignalR ───────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (!this.isBrowser || this.hub) return;

    // Dynamic import keeps SSR bundle clean
    const signalR = await import('@microsoft/signalr');

    this.hub = new signalR.HubConnectionBuilder()
      .withUrl(environment.hubUrl, {
        accessTokenFactory: () => this.auth.getToken() ?? '',
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect()
      .build();

    this.hub.on('ReceiveMessage', (raw: any) => {
      const msg: MessageResult = {
        Id:             raw.id             ?? raw.Id,
        ConversationId: raw.conversationId ?? raw.ConversationId,
        SenderId:       raw.senderId       ?? raw.SenderId,
        Content:        raw.content        ?? raw.Content,
        SentAt:         raw.sentAt         ?? raw.SentAt,
        IsRead:         raw.isRead         ?? raw.IsRead,
      };
      this.zone.run(() => this.receiveMessage$.next(msg));
    });
    this.hub.on('MessagesRead', (raw: any) => {
      const n: MessagesReadNotification = {
        ConversationId: raw.conversationId ?? raw.ConversationId,
        ReadByUserId:   raw.readByUserId   ?? raw.ReadByUserId,
      };
      this.zone.run(() => this.messagesRead$.next(n));
    });
    this.hub.on('FriendOnline',  (userId: string) => this.zone.run(() => this.friendOnline$.next(userId)));
    this.hub.on('FriendOffline', (userId: string) => this.zone.run(() => this.friendOffline$.next(userId)));

    this.hub.onreconnected(() => this.zone.run(() => this.connected$.next(true)));
    this.hub.onclose(()      => this.zone.run(() => this.connected$.next(false)));

    try {
      await this.hub.start();
      // onreconnected handles future reconnects; no emit here to avoid duplicate API calls
    } catch (err) {
      console.error('[SignalR] Connection error:', err);
    }
  }

  disconnect(): void {
    if (this.hub) {
      this.hub.stop();
      this.hub = null;
    }
  }

  sendMessage(receiverUserId: string, content: string): Promise<void> {
    if (!this.hub) return Promise.reject(new Error('Not connected'));
    return this.hub.invoke('SendMessage', receiverUserId, content);
  }

  markAsRead(conversationId: string): Promise<void> {
    if (!this.hub) return Promise.reject(new Error('Not connected'));
    return this.hub.invoke('MarkAsRead', conversationId);
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.receiveMessage$.complete();
    this.messagesRead$.complete();
    this.friendOnline$.complete();
    this.friendOffline$.complete();
    this.connected$.complete();
  }
}
