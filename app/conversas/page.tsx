import type { Metadata } from "next";
import { ConversationList } from "@/components/conversation-list";

export const metadata: Metadata = { title: "Conversas de demonstração" };

export default function ConversationsPage() {
  return <ConversationList />;
}
