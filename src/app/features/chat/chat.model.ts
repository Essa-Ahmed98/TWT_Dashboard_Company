export enum MessageType {
  Text  = 0,
  Audio = 1,
  Image = 2,
  Call  = 3,   // سجل مكالمة صوت / فيديو (السيرفر بيكتبه)
}

export enum UserRole {
  Pilgrim    = 0,
  Family     = 1,
  Supervisor = 2,
  Admin      = 3,   // مدير البعثة (مدير الشركة)
  SuperAdmin = 4,
  Specific   = 5,   // موظف في الشركة (صلاحيات محددة)
  Delegate   = 6,
  TourLeader = 7,
}

/** Arabic fallback labels (the page itself uses ROLE_LABEL_KEYS through the translations) */
export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.Pilgrim]:    'حاج',
  [UserRole.Family]:     'عائلة',
  [UserRole.Supervisor]: 'مشرف',
  [UserRole.Admin]:      'مدير البعثة',
  [UserRole.SuperAdmin]: 'الإدارة العامة',
  [UserRole.Specific]:   'موظف',
  [UserRole.Delegate]:   'مندوب',
  [UserRole.TourLeader]: 'قائد فوج',
};

/** i18n keys of the role labels shown in the chat (CHAT.ROLES.*) */
export const ROLE_LABEL_KEYS: Record<UserRole, string> = {
  [UserRole.Pilgrim]:    'CHAT.ROLES.PILGRIM',
  [UserRole.Family]:     'CHAT.ROLES.FAMILY',
  [UserRole.Supervisor]: 'CHAT.ROLES.SUPERVISOR',
  [UserRole.Admin]:      'CHAT.ROLES.ADMIN',
  [UserRole.SuperAdmin]: 'CHAT.ROLES.SUPER_ADMIN',
  [UserRole.Specific]:   'CHAT.ROLES.SPECIFIC',
  [UserRole.Delegate]:   'CHAT.ROLES.DELEGATE',
  [UserRole.TourLeader]: 'CHAT.ROLES.TOUR_LEADER',
};

/** The "management" tab: the company manager, its staff (and the platform administration if such a chat exists) */
export const MANAGEMENT_ROLES: readonly UserRole[] = [UserRole.Admin, UserRole.Specific, UserRole.SuperAdmin];

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
  /** بيانات المكالمة - لرسائل MessageType.Call بس */
  Call?: MessageCallInfo | null;
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

/** Returned by GET /api/chat/search-colleagues - managers and staff of the same company (never the caller) */
export interface ColleagueSearchResult {
  UserId: string;
  DisplayName: string;
  AvatarUrl: string | null;
  Role: UserRole;
  IsOnline: boolean;
}

/** One person in the "new conversation" search, whatever list it came from */
export interface ChatContact {
  UserId: string;
  DisplayName: string;
  Role: UserRole;
  IsOnline: boolean;
}

/** Returned by GET /api/chat/unread-count */
export interface UnreadCountResult {
  TotalUnreadCount: number;
}

// ── SignalR event payloads ────────────────────────────────────────

export interface MessagesReadNotification {
  ConversationId: string;
  ReadByUserId: string;
}

// ── UI-only ──────────────────────────────────────────────────────
export type ChatTab = 'all' | 'groups' | 'supervisors' | 'management';

/** Who the "new conversation" search looks for */
export type NewChatScope = 'pilgrims' | 'supervisors' | 'management';

// ── Calls (voice / video over LiveKit) ───────────────────────────
export enum CallType {
  Audio = 1,
  Video = 2,
}

export enum CallStatus {
  Ringing   = 1,
  Accepted  = 2,
  Rejected  = 3,
  Cancelled = 4,
  Missed    = 5,
  Busy      = 6,
  Ended     = 7,
}

export enum CallEndReason {
  CallerHangup        = 1,
  CalleeHangup        = 2,
  Rejected            = 3,
  Cancelled           = 4,
  Timeout             = 5,
  Busy                = 6,
  ParticipantLeft     = 7,
  RoomFinished        = 8,
  MaxDurationExceeded = 9,
}

/** Call log inside a chat message */
export interface MessageCallInfo {
  CallId: string;
  CallType: CallType;
  Status: CallStatus;
  EndReason?: CallEndReason | null;
  DurationSeconds: number;
}

/** A call, as sent by the chat hub events and returned by the hub methods / REST */
export interface CallPayload {
  CallId: string;
  ConversationId: string;
  CallType: CallType;
  Status: CallStatus;
  CallerId: string;
  CallerName: string;
  CallerAvatarUrl: string | null;
  CalleeId: string;
  CalleeName: string;
  CalleeAvatarUrl: string | null;
  CreatedAt: string;
  AnsweredAt: string | null;
  EndedAt: string | null;
  EndReason: CallEndReason | null;
}

/** Reply of the hub call methods (StartCall / AcceptCall / ...) */
export interface CallHubResult {
  Success: boolean;
  Call: CallPayload | null;
  ErrorCode?: number | null;
  ErrorKey?: string | null;
  ErrorMessage?: string | null;
}

/** POST /api/chat/calls/{callId}/token */
export interface CallTokenResult {
  CallId: string;
  RoomName: string;
  Url: string;
  Token: string;
  Identity: string;
  ExpiresAt: string;
}
