// ── NexusChat Types ──────────────────────────────────────────────────────────

export type UserRole = "staff" | "admin" | "superadmin" | "supremo";

export type MessageType = "text" | "emoji" | "sticker" | "gif" | "meeting" | "voice";

export interface ChatUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;       // Cloudinary URL
  status?: string;
  isOnline: boolean;
  lastSeen?: string;
}

export interface Reaction {
  emoji: string;
  users: string[];      // user IDs
}

export interface MeetingPayload {
  title: string;
  link: string;
  createdBy: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  author: ChatUser;
  type: MessageType;
  text?: string;
  gif?: string;
  meeting?: MeetingPayload;
  reactions: Record<string, string[]>;  // emoji → userId[]
  createdAt: string;
  readBy?: string[];
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  type: "public" | "private" | "dm";
  members?: string[];
  unread?: number;
}

export interface OnboardingModule {
  id: string;
  name: string;
  description: string;
  icon: string;
  addedAt: string;
}

export type PickerTab = "emoji" | "sticker" | "gif";
