import { Injectable, inject, PLATFORM_ID, NgZone, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/services/auth';
import { ApiResult, PaginatedResult } from '../../core/models/api.models';
import {
  CallHubResult,
  CallPayload,
  CallTokenResult,
  CallType,
  ChatContact,
  ColleagueSearchResult,
  MessageCallInfo,
  ConversationResult,
  MessageResult,
  MessageType,
  MessagesPageResult,
  MessagesReadNotification,
  OpenConversationResult,
  PilgrimSearchResult,
  UnreadCountResult,
  UploadAudioResult,
  UploadImageResult,
  UserRole,
} from './chat.model';

/** How many people the "new conversation" search shows */
const CONTACT_SEARCH_LIMIT = 20;

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
  readonly incomingCall$   = new Subject<CallPayload>();
  readonly callEvent$      = new Subject<{ event: CallEventName; call: CallPayload }>();

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
      `${environment.chatApiBase}/chat/search-pilgrims?searchText=${encodeURIComponent(query)}`,
    );
  }

  /** Managers and staff of my company (chat server, scoped by the company of the token) */
  searchColleagues(query: string): Observable<ChatContact[]> {
    const params = new HttpParams().set('searchText', query.trim()).set('limit', CONTACT_SEARCH_LIMIT);
    return this.http
      .get<ApiResult<ColleagueSearchResult[]>>(`${environment.chatApiBase}/chat/search-colleagues`, { params })
      .pipe(map(res => (res.IsSuccess ? res.Data ?? [] : []).map(c => ({
        UserId: c.UserId, DisplayName: c.DisplayName, Role: c.Role, IsOnline: c.IsOnline,
      }))));
  }

  /** Pilgrims of my company (the same list as the pilgrims page - needs the Pilgrims permission) */
  searchPilgrimContacts(query: string): Observable<ChatContact[]> {
    let params = new HttpParams().set('PageNumber', 1).set('PageSize', CONTACT_SEARCH_LIMIT);
    if (query.trim()) params = params.set('Search', query.trim());
    return this.http
      .get<ApiResult<PaginatedResult<{ UserId: string; DisplayName: string }>>>(`${environment.apiBase}/Pilgrims/for-admin`, { params })
      .pipe(map(res => (res.IsSuccess ? res.Data?.Items ?? [] : [])
        .filter(p => !!p.UserId)
        .map(p => ({ UserId: p.UserId, DisplayName: p.DisplayName, Role: UserRole.Pilgrim, IsOnline: false }))));
  }

  /** Supervisors of my company (the same list as the supervisors page - needs the Supervisors permission) */
  searchSupervisorContacts(query: string): Observable<ChatContact[]> {
    let params = new HttpParams().set('PageNumber', 1).set('PageSize', CONTACT_SEARCH_LIMIT);
    if (query.trim()) params = params.set('Search', query.trim());
    return this.http
      .get<ApiResult<{ Supervisors: PaginatedResult<{ UserId: string; DisplayName?: string; IsOnline: boolean }> }>>(
        `${environment.apiBase}/Supervisors`, { params })
      .pipe(map(res => (res.IsSuccess ? res.Data?.Supervisors?.Items ?? [] : [])
        .filter(s => !!s.UserId)
        .map(s => ({ UserId: s.UserId, DisplayName: s.DisplayName ?? '', Role: UserRole.Supervisor, IsOnline: s.IsOnline }))));
  }

  getUnreadCount() {
    return this.http.get<ApiResult<UnreadCountResult>>(
      `${environment.chatApiBase}/chat/unread-count`,
    );
  }

  // ── SignalR ───────────────────────────────────────────────────────

  private connecting: Promise<void> | null = null;

  /** Opens the hub once. Two callers at the same time (layout + chat page) share one connection;
   *  before, both passed the `this.hub` check while the import was loading and opened two
   *  connections, so every message arrived twice. */
  connect(): Promise<void> {
    if (!this.isBrowser || this.hub) return Promise.resolve();
    this.connecting ??= this.openHub().finally(() => (this.connecting = null));
    return this.connecting;
  }

  private async openHub(): Promise<void> {
    // Dynamic import keeps SSR bundle clean
    const signalR = await import('@microsoft/signalr');
    if (this.hub) return;

    this.hub = new signalR.HubConnectionBuilder()
      // the WebSocket handshake can't carry our Accept-Language header, so the language goes in the query
      // (otherwise call errors come back in the browser's language, e.g. English)
      .withUrl(`${environment.hubUrl}${environment.hubUrl.includes('?') ? '&' : '?'}culture=ar&ui-culture=ar`, {
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
        Content:        raw.content     ?? raw.Content     ?? '',
        MessageType:    raw.messageType ?? raw.MessageType ?? MessageType.Text,
        AudioUrl:       raw.audioUrl    ?? raw.AudioUrl    ?? null,
        ImageUrl:       raw.imageUrl    ?? raw.ImageUrl    ?? null,
        SentAt:         raw.sentAt         ?? raw.SentAt,
        IsRead:         raw.isRead         ?? raw.IsRead,
        Call:           mapCallInfo(raw.call ?? raw.Call),
      };
      this.zone.run(() => this.receiveMessage$.next(msg));
    });

    // ── Calls (voice / video) ──
    this.hub.on('IncomingCall', (raw: any) => this.zone.run(() => this.incomingCall$.next(mapCall(raw))));
    for (const name of ['CallAccepted', 'CallRejected', 'CallCancelled', 'CallMissed', 'CallEnded', 'CallAnsweredElsewhere']) {
      this.hub.on(name, (raw: any) => this.zone.run(() => this.callEvent$.next({ event: name as CallEventName, call: mapCall(raw) })));
    }
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

  uploadAudio(file: File) {
    const form = new FormData();
    form.append('audioFile', file);
    return this.http.post<ApiResult<UploadAudioResult>>(
      `${environment.chatApiBase}/chat/upload-audio`, form,
    );
  }

  uploadImage(file: File) {
    const form = new FormData();
    form.append('imageFile', file);
    return this.http.post<ApiResult<UploadImageResult>>(
      `${environment.chatApiBase}/chat/upload-image`, form,
    );
  }

  sendMessage(receiverUserId: string, content: string): Promise<void> {
    if (!this.hub) return Promise.reject(new Error('Not connected'));
    return this.hub.invoke('SendMessage', receiverUserId, content);
  }

  sendAudioMessage(receiverUserId: string, audioUrl: string): Promise<void> {
    if (!this.hub) return Promise.reject(new Error('Not connected'));
    return this.hub.invoke('SendAudioMessage', receiverUserId, audioUrl);
  }

  sendImageMessage(receiverUserId: string, imageUrl: string): Promise<void> {
    if (!this.hub) return Promise.reject(new Error('Not connected'));
    return this.hub.invoke('SendImageMessage', receiverUserId, imageUrl);
  }

  markAsRead(conversationId: string): Promise<void> {
    if (!this.hub) return Promise.reject(new Error('Not connected'));
    return this.hub.invoke('MarkAsRead', conversationId);
  }

  // ── Calls (voice / video) ─────────────────────────────────────────

  startCall(calleeId: string, callType: CallType): Promise<CallHubResult> {
    return this.invokeCall('StartCall', calleeId, callType);
  }

  acceptCall(callId: string): Promise<CallHubResult> {
    return this.invokeCall('AcceptCall', callId);
  }

  rejectCall(callId: string): Promise<CallHubResult> {
    return this.invokeCall('RejectCall', callId);
  }

  cancelCall(callId: string): Promise<CallHubResult> {
    return this.invokeCall('CancelCall', callId);
  }

  endCall(callId: string): Promise<CallHubResult> {
    return this.invokeCall('EndCall', callId);
  }

  /** LiveKit room token for this call (POST /api/chat/calls/{callId}/token) */
  getCallToken(callId: string) {
    return this.http.post<ApiResult<CallTokenResult>>(
      `${environment.chatApiBase}/chat/calls/${callId}/token`, {},
    );
  }

  private async invokeCall(method: string, ...args: unknown[]): Promise<CallHubResult> {
    if (!this.hub) {
      await this.connect();
      if (!this.hub) return { Success: false, Call: null, ErrorCode: 0, ErrorMessage: 'Not connected' };
    }
    const raw = await this.hub.invoke(method, ...args);
    return {
      Success:      raw.success ?? raw.Success ?? false,
      Call:         (raw.call ?? raw.Call) ? mapCall(raw.call ?? raw.Call) : null,
      ErrorCode:    raw.errorCode ?? raw.ErrorCode ?? null,
      ErrorKey:     raw.errorKey ?? raw.ErrorKey ?? null,
      ErrorMessage: raw.errorMessage ?? raw.ErrorMessage ?? null,
    };
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.receiveMessage$.complete();
    this.messagesRead$.complete();
    this.friendOnline$.complete();
    this.friendOffline$.complete();
    this.connected$.complete();
    this.incomingCall$.complete();
    this.callEvent$.complete();
  }
}

export type CallEventName =
  | 'CallAccepted' | 'CallRejected' | 'CallCancelled' | 'CallMissed' | 'CallEnded' | 'CallAnsweredElsewhere';

// SignalR sends camelCase, REST sends PascalCase - accept both
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCall(raw: any): CallPayload {
  return {
    CallId:          raw.callId          ?? raw.CallId,
    ConversationId:  raw.conversationId  ?? raw.ConversationId,
    CallType:        raw.callType        ?? raw.CallType,
    Status:          raw.status          ?? raw.Status,
    CallerId:        raw.callerId        ?? raw.CallerId,
    CallerName:      raw.callerName      ?? raw.CallerName ?? '',
    CallerAvatarUrl: raw.callerAvatarUrl ?? raw.CallerAvatarUrl ?? null,
    CalleeId:        raw.calleeId        ?? raw.CalleeId,
    CalleeName:      raw.calleeName      ?? raw.CalleeName ?? '',
    CalleeAvatarUrl: raw.calleeAvatarUrl ?? raw.CalleeAvatarUrl ?? null,
    CreatedAt:       raw.createdAt       ?? raw.CreatedAt,
    AnsweredAt:      raw.answeredAt      ?? raw.AnsweredAt ?? null,
    EndedAt:         raw.endedAt         ?? raw.EndedAt ?? null,
    EndReason:       raw.endReason       ?? raw.EndReason ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCallInfo(raw: any): MessageCallInfo | null {
  if (!raw) return null;
  return {
    CallId:          raw.callId          ?? raw.CallId,
    CallType:        raw.callType        ?? raw.CallType,
    Status:          raw.status          ?? raw.Status,
    EndReason:       raw.endReason       ?? raw.EndReason ?? null,
    DurationSeconds: raw.durationSeconds ?? raw.DurationSeconds ?? 0,
  };
}
