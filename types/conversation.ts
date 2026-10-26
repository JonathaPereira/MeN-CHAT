export type Conversation = {
  id: string;
  name: string;
  initials: string;
  color: "sage" | "peach" | "lavender" | "blue";
  preview: string;
  time: string;
  unread: number;
  kind: "group" | "person";
  description: string;
};
