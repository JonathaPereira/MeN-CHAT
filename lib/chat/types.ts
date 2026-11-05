export type ChatThread = {
  id: string;
  name: string;
  can_send: boolean;
  kind: "private" | "group";
  avatar_path: string | null;
  creator_id: string | null;
  owner_id: string | null;
  last_body: string | null;
  last_at: string;
  last_sender: string | null;
  unread_count?: number;
};
export type ChatMessage = {
  id: string;
  seq: number;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  attachment_id: string | null;
  deleted_at?: string | null;
  reply_to?: string | null;
  mention_ids?: string[];
};
export type Participant = {
  id: string;
  name: string;
  status: string;
  avatar_path: string | null;
  code: string | null;
  role: "admin" | "member";
  received_seq: number;
  read_seq: number | null;
  is_typing: boolean;
  shares_read: boolean;
};
export type Upload = {
  is_sticker?: boolean;
  id: string;
  path: string;
  kind: "image" | "video" | "audio" | "document" | "avatar";
  name: string;
  mime: string;
  bytes: number;
};
export type RealProfile = {
  id: string;
  display_name: string;
  user_code: string;
  status_message: string;
  avatar_path: string | null;
  show_code: boolean;
  allow_code_lookup: boolean;
  read_receipts: boolean;
  show_typing: boolean;
};
