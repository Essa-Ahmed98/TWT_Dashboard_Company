import {
  ChangeDetectionStrategy,
  Component,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  DestroyRef,
  PLATFORM_ID,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isPlatformBrowser, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth/services/auth';
import { ChatService } from './chat.service';
import {
  ChatTab,
  ConversationResult,
  MessageResult,
  MessageType,
  ROLE_LABELS,
  UserRole,
} from './chat.model';

@Component({
  selector: 'app-chat',
  imports: [FormsModule],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Chat implements OnInit, OnDestroy {
  @ViewChild('msgsEl') msgsEl!: ElementRef<HTMLDivElement>;

  readonly MessageType = MessageType;

  private readonly chatService = inject(ChatService);
  private readonly auth        = inject(AuthService);
  private readonly route       = inject(ActivatedRoute);
  private readonly location    = inject(Location);
  private readonly destroyRef  = inject(DestroyRef);
  private readonly isBrowser   = isPlatformBrowser(inject(PLATFORM_ID));

  // ── State ──────────────────────────────────────────────────────
  conversations  = signal<ConversationResult[]>([]);
  activeMessages = signal<MessageResult[]>([]);
  activeConvId   = signal<string | null>(null);
  activeFriendId = signal<string | null>(null);
  nextCursor     = signal<string | null>(null);

  activeTab    = signal<ChatTab>('all');
  newMessage   = signal('');
  searchQuery  = signal('');
  sendError    = signal<string | null>(null);

  loadingConvs   = signal(false);
  loadingMsgs    = signal(false);
  loadingMore    = signal(false);
  isConnected    = signal(false);
  uploadingMedia      = signal(false);
  isRecording         = signal(false);
  recordingSeconds    = signal(0);
  recordingBlob       = signal<Blob | null>(null);
  recordingPreviewUrl = signal<string | null>(null);
  imagePreviewFile    = signal<File | null>(null);
  imagePreviewUrl     = signal<string | null>(null);

  recordingLabel = computed(() => {
    const s = this.recordingSeconds();
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  });

  private mediaRecorder:     MediaRecorder | null = null;
  private audioChunks:       Blob[]               = [];
  private recordingInterval: ReturnType<typeof setInterval> | null = null;
  private discardOnStop      = false;

  // ── Computed ───────────────────────────────────────────────────
  filteredConversations = computed(() => {
    const q   = this.searchQuery().toLowerCase().trim();
    const tab = this.activeTab();
    return this.conversations().filter(c => {
      const matchSearch = !q || c.FriendDisplayName.toLowerCase().includes(q);
      const matchTab =
        tab === 'all' ||
        (tab === 'supervisors' && c.FriendRole === UserRole.Supervisor) ||
        (tab === 'groups'      && c.FriendRole === UserRole.Pilgrim);
      return matchSearch && matchTab;
    });
  });

  totalUnread = computed(() =>
    this.conversations().reduce((s, c) => s + c.UnreadCount, 0),
  );

  activeConversation = computed(() =>
    this.conversations().find(c => c.FriendId === this.activeFriendId()) ?? null,
  );

  // ── Lifecycle ──────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadConversations();
    if (this.isBrowser) {
      this.chatService.connect();
      this.subscribeToSignalR();
    }

    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const userId = params['userId'];
        if (userId) {
          const state = this.location.getState() as { displayName?: string } | null;
          this.openConversationByUserId(userId, state?.displayName);
        }
      });
  }

  ngOnDestroy(): void {
    this.discardOnStop = true;
    this.stopRecording();
    this.discardPreview();
    this.discardImagePreview();
    this.chatService.disconnect();
  }

  // ── REST calls ─────────────────────────────────────────────────
  private loadConversations(): void {
    this.loadingConvs.set(true);
    this.chatService
      .getConversations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (res.IsSuccess) this.conversations.set(res.Data);
          this.loadingConvs.set(false);
        },
        error: () => this.loadingConvs.set(false),
      });
  }

  openConversationByUserId(userId: string, displayName?: string): void {
    if (this.activeFriendId() === userId && this.loadingMsgs()) return;

    this.conversations.update(list => {
      if (list.some(c => c.FriendId === userId)) return list;
      return [{
        ConversationId: '',
        FriendId: userId,
        FriendDisplayName: displayName || userId,
        FriendRole: UserRole.Pilgrim,
        IsOnline: false,
        LastMessagePreview: '',
        LastMessageSenderId: '',
        LastMessageAt: '',
        UnreadCount: 0,
      }, ...list];
    });

    this.activeFriendId.set(userId);
    this.activeConvId.set(null);
    this.activeMessages.set([]);
    this.nextCursor.set(null);
    this.loadingMsgs.set(true);
    this.sendError.set(null);

    this.chatService
      .openConversation(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (!res.IsSuccess) { this.loadingMsgs.set(false); return; }
          const d = res.Data;
          this.activeConvId.set(d.ConversationId);
          this.activeMessages.set(d.Messages);
          this.nextCursor.set(d.NextCursor);
          this.loadingMsgs.set(false);

          this.conversations.update(list => {
            const exists = list.some(c => c.FriendId === userId);
            if (exists) {
              return list.map(c =>
                c.FriendId === userId
                  ? { ...c, ConversationId: d.ConversationId, IsOnline: d.FriendIsOnline, UnreadCount: 0 }
                  : c,
              );
            }
            return [{
              ConversationId: d.ConversationId,
              FriendId: userId,
              FriendDisplayName: displayName || userId,
              FriendRole: UserRole.Pilgrim,
              IsOnline: d.FriendIsOnline,
              LastMessagePreview: '',
              LastMessageSenderId: '',
              LastMessageAt: new Date().toISOString(),
              UnreadCount: 0,
            }, ...list];
          });

          if (d.IsNewConversation) this.loadConversations();
          this.chatService.markAsRead(d.ConversationId).catch(() => {});
          setTimeout(() => this.scrollToBottom(), 60);
        },
        error: () => this.loadingMsgs.set(false),
      });
  }

  selectConversation(conv: ConversationResult): void {
    if (this.activeFriendId() === conv.FriendId && this.loadingMsgs()) return;

    this.activeFriendId.set(conv.FriendId);
    this.activeConvId.set(null);
    this.activeMessages.set([]);
    this.nextCursor.set(null);
    this.loadingMsgs.set(true);
    this.sendError.set(null);

    this.chatService
      .openConversation(conv.FriendId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (!res.IsSuccess) { this.loadingMsgs.set(false); return; }
          const d = res.Data;
          this.activeConvId.set(d.ConversationId);
          this.activeMessages.set(d.Messages);
          this.nextCursor.set(d.NextCursor);
          this.loadingMsgs.set(false);

          // sync online status + clear unread in sidebar
          this.conversations.update(list =>
            list.map(c =>
              c.FriendId === conv.FriendId
                ? { ...c, IsOnline: d.FriendIsOnline, UnreadCount: 0 }
                : c,
            ),
          );

          // server already marks as read on open, invoke via SignalR too
          this.chatService.markAsRead(d.ConversationId).catch(() => {});
          setTimeout(() => this.scrollToBottom(), 60);
        },
        error: () => this.loadingMsgs.set(false),
      });
  }

  loadMoreMessages(): void {
    const convId = this.activeConvId();
    const cursor = this.nextCursor();
    if (!convId || !cursor || this.loadingMore()) return;

    this.loadingMore.set(true);
    const el         = this.msgsEl?.nativeElement;
    const prevHeight = el?.scrollHeight ?? 0;

    this.chatService
      .getMessages(convId, cursor)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (res.IsSuccess) {
            this.activeMessages.update(msgs => [...res.Data.Messages, ...msgs]);
            this.nextCursor.set(res.Data.NextCursor);
            setTimeout(() => {
              if (el) el.scrollTop = el.scrollHeight - prevHeight;
              this.loadingMore.set(false);
            }, 0);
          } else {
            this.loadingMore.set(false);
          }
        },
        error: () => this.loadingMore.set(false),
      });
  }

  // ── Send ───────────────────────────────────────────────────────
  sendMessage(): void {
    const text     = this.newMessage().trim();
    const friendId = this.activeFriendId();
    if (!text || !friendId) return;

    this.newMessage.set('');
    this.sendError.set(null);

    this.chatService.sendMessage(friendId, text).catch(err => {
      this.sendError.set(err?.message ?? 'فشل إرسال الرسالة');
      this.newMessage.set(text);
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }


  async toggleRecording(): Promise<void> {
    if (this.isRecording()) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      this.mediaRecorder = new MediaRecorder(stream, { mimeType });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (this.discardOnStop) {
          this.discardOnStop = false;
          this.audioChunks = [];
          return;
        }
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioChunks = [];
        this.recordingBlob.set(blob);
        this.recordingPreviewUrl.set(URL.createObjectURL(blob));
      };

      this.mediaRecorder.start();
      this.isRecording.set(true);
      this.recordingSeconds.set(0);
      this.recordingInterval = setInterval(
        () => this.recordingSeconds.update(s => s + 1),
        1000,
      );
    } catch {
      this.sendError.set('لم يتم السماح بالوصول للميكروفون');
    }
  }

  private stopRecording(): void {
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
    this.isRecording.set(false);
    this.mediaRecorder?.stop();
    this.mediaRecorder = null;
  }

  cancelRecording(): void {
    this.discardOnStop = true;
    this.stopRecording();
  }

  discardPreview(): void {
    const url = this.recordingPreviewUrl();
    if (url) URL.revokeObjectURL(url);
    this.recordingBlob.set(null);
    this.recordingPreviewUrl.set(null);
  }

  sendRecording(): void {
    const blob     = this.recordingBlob();
    const friendId = this.activeFriendId();
    if (!blob || !friendId) return;

    this.discardPreview();

    const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
    this.uploadingMedia.set(true);
    this.sendError.set(null);

    this.chatService.uploadAudio(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (!res.IsSuccess) {
            this.sendError.set('فشل رفع الرسالة الصوتية');
            this.uploadingMedia.set(false);
            return;
          }
          this.chatService.sendAudioMessage(friendId, res.Data.AudioUrl)
            .catch(err => this.sendError.set(err?.message ?? 'فشل إرسال الرسالة الصوتية'))
            .finally(() => this.uploadingMedia.set(false));
        },
        error: () => { this.sendError.set('فشل رفع الرسالة الصوتية'); this.uploadingMedia.set(false); },
      });
  }

  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.discardImagePreview();
    this.imagePreviewFile.set(file);
    this.imagePreviewUrl.set(URL.createObjectURL(file));
  }

  discardImagePreview(): void {
    const url = this.imagePreviewUrl();
    if (url) URL.revokeObjectURL(url);
    this.imagePreviewFile.set(null);
    this.imagePreviewUrl.set(null);
  }

  sendImage(): void {
    const file     = this.imagePreviewFile();
    const friendId = this.activeFriendId();
    if (!file || !friendId) return;

    this.discardImagePreview();
    this.uploadingMedia.set(true);
    this.sendError.set(null);

    this.chatService.uploadImage(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (!res.IsSuccess) {
            this.sendError.set('فشل رفع الصورة');
            this.uploadingMedia.set(false);
            return;
          }
          this.chatService.sendImageMessage(friendId, res.Data.ImageUrl)
            .catch(err => this.sendError.set(err?.message ?? 'فشل إرسال الصورة'))
            .finally(() => this.uploadingMedia.set(false));
        },
        error: () => { this.sendError.set('فشل رفع الصورة'); this.uploadingMedia.set(false); },
      });
  }

  onMessagesScroll(event: Event): void {
    const el = event.target as HTMLDivElement;
    if (el.scrollTop === 0 && this.nextCursor() && !this.loadingMore()) {
      this.loadMoreMessages();
    }
  }

  setTab(tab: ChatTab): void {
    this.activeTab.set(tab);
  }

  // ── SignalR subscriptions ──────────────────────────────────────
  private subscribeToSignalR(): void {
    const myId = () => this.auth.currentUser()?.userId;

    this.chatService.connected$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(v => {
        const wasDisconnected = !this.isConnected() && v;
        this.isConnected.set(v);
        if (wasDisconnected) {
          this.loadConversations();
        }
      });

    this.chatService.receiveMessage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(msg => {
        if (msg.ConversationId === this.activeConvId()) {
          // append to open chat window
          this.activeMessages.update(msgs => [...msgs, msg]);
          setTimeout(() => this.scrollToBottom(), 60);

          // mark as read (we're watching this conversation)
          if (msg.SenderId !== myId()) {
            this.chatService.markAsRead(msg.ConversationId).catch(() => {});
          }
        } else {
          // update sidebar: bump unread + preview
          this.conversations.update(list => {
            const preview =
              msg.MessageType === MessageType.Image ? '[صورة]'
            : msg.MessageType === MessageType.Audio ? '[رسالة صوتية]'
            : msg.Content;
            const updated = list.map(c =>
              c.ConversationId === msg.ConversationId
                ? {
                    ...c,
                    UnreadCount:         c.UnreadCount + 1,
                    LastMessagePreview:  preview,
                    LastMessageAt:       msg.SentAt,
                    LastMessageSenderId: msg.SenderId,
                  }
                : c,
            );
            // re-sort newest first
            return [...updated].sort(
              (a, b) =>
                new Date(b.LastMessageAt).getTime() -
                new Date(a.LastMessageAt).getTime(),
            );
          });
        }
      });

    this.chatService.messagesRead$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(n => {
        if (n.ConversationId === this.activeConvId()) {
          this.activeMessages.update(msgs =>
            msgs.map(m => ({ ...m, IsRead: true })),
          );
        }
      });

    this.chatService.friendOnline$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(userId => {
        this.conversations.update(list =>
          list.map(c => (c.FriendId === userId ? { ...c, IsOnline: true } : c)),
        );
      });

    this.chatService.friendOffline$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(userId => {
        this.conversations.update(list =>
          list.map(c => (c.FriendId === userId ? { ...c, IsOnline: false } : c)),
        );
      });
  }

  // ── Helpers ───────────────────────────────────────────────────
  isMine(msg: MessageResult): boolean {
    return msg.SenderId === this.auth.currentUser()?.userId;
  }

  getAvatarColor(id: string): string {
    const palette = [
      '#0b5c3e', '#7b5ea7', '#c0392b', '#0b6e6e',
      '#b7450a', '#6b2fa0', '#0b405b', '#2c7873',
    ];
    let hash = 0;
    for (const ch of id) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }

  getRoleLabel(role: UserRole): string {
    return ROLE_LABELS[role] ?? '';
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('ar-SA', {
      hour:   '2-digit',
      minute: '2-digit',
    });
  }

  lastMessageTime(conv: ConversationResult): string {
    return this.formatTime(conv.LastMessageAt);
  }

  private scrollToBottom(): void {
    const el = this.msgsEl?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
