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
export type Chat = {
  id: string;
  name: string;
  kind: "person" | "group";
  memberIds: string[];
  color: string;
  unread: number;
  messages: Message[];
};
