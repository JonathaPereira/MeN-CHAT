export type Profile = {
  name: string;
  status: string;
  photo: string;
  code: string;
};
export type Contact = {
  id: string;
  name: string;
  code: string;
  status: string;
  color: string;
  privacy: {
    showCode: boolean;
    allowCodeLookup: boolean;
    readReceipts: boolean;
    showTyping: boolean;
  };
};
export type Attachment = {
  id: string;
  name: string;
  size: number;
  kind: "image" | "video" | "document" | "audio";
  url: string;
  sticker?: boolean;
};
export type ReadReceipt = { contactId: string; time: string };
export type Message = {
  id: string;
  text: string;
  outgoing: boolean;
  author?: string;
  time: string;
  attachments: Attachment[];
  readBy?: ReadReceipt[];
};
export type GroupInfo = {
  creatorId: string;
  ownerId: string | null;
  adminIds: string[];
  selfMember: boolean;
};
export type Chat = {
  id: string;
  name: string;
  kind: "person" | "group";
  group?: GroupInfo;
  memberIds: string[];
  color: string;
  unread: number;
  messages: Message[];
};
