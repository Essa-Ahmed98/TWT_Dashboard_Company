export enum MessageType {
  Text  = 0,
  Audio = 1,
  Image = 2,
}

export enum UserRole {
  Pilgrim    = 0,
  Family     = 1,
  Supervisor = 2,
  Admin      = 3,
  SuperAdmin = 4,
}

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.Pilgrim]:    'حاج',
  [UserRole.Family]:     'عائلة',
  [UserRole.Supervisor]: 'مشرف',
  [UserRole.Admin]:      'مسؤول',
  [UserRole.SuperAdmin]: 'مسؤول عام',
};

// ── REST DTOs ────────────────────────────────────────────────────

/** Returned by GET /api/chat/conversations */
export interface ConversationResult {
  ConversationId: string;
  FriendId: string;
  FriendDisplayName: string;
  FriendRole: UserRole;
  IsOnline: boolean;
  LastMessagePreview: string;
  LastMessageSenderId: string;
  LastMessageAt: string;
  UnreadCount: number;
}

/** Returned by GET /api/chat/open/{friendId} */
export interface OpenConversationResult {
  ConversationId: string;
  IsNewConversation: boolean;
  FriendIsOnline: boolean;
  Messages: MessageResult[];
  NextCursor: string | null;
}

/** Returned by GET /api/chat/{conversationId}/messages */
export interface MessagesPageResult {
  ConversationId: string;
  Messages: MessageResult[];
  NextCursor: string | null;
}

/** Single message DTO (used in both REST and SignalR) */
export interface MessageResult {
  Id: string;
  ConversationId: string;
  SenderId: string;
  Content: string;
  MessageType: MessageType;
  AudioUrl: string | null;
  ImageUrl: string | null;
  SentAt: string;
  IsRead: boolean;
}

/** Returned by POST /api/chat/upload-audio */
export interface UploadAudioResult { AudioUrl: string; }

/** Returned by POST /api/chat/upload-image */
export interface UploadImageResult { ImageUrl: string; }

/** Returned by GET /api/chat/search-pilgrims */
export interface PilgrimSearchResult {
  UserId: string;
  DisplayName: string;
  Role: UserRole;
}

/** Returned by GET /api/chat/unread-count */
export interface UnreadCountResult {
  UnreadCount: number;
}

// ── SignalR event payloads ────────────────────────────────────────

export interface MessagesReadNotification {
  ConversationId: string;
  ReadByUserId: string;
}

// ── UI-only ──────────────────────────────────────────────────────
export type ChatTab = 'all' | 'groups' | 'supervisors';
