"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MoreHorizontal,
  Bot,
  Check,
  CheckCheck,
  Settings,
} from "lucide-react";
import { ChatDetailsDialog, type ChatDetail } from "./chat-details-dialog";
import { TypingIndicator } from "./typing-indicator";
import { usePreferences } from "@/components/preferences-provider";
import { chatMembers, visibleReaders } from "@/lib/chat-privacy";
import { groupMemberIds } from "@/lib/group-rules";
import { Avatar } from "@/components/avatar";
import { useDemo } from "@/components/demo-provider";
import { contacts } from "@/lib/data/chat";
import type { Chat } from "@/types/chat";
import { AttachmentPreview } from "./attachment-preview";
import { Composer } from "./composer";

export function ChatPanel({
  chat,
  onBack,
  onMenu,
  onOpenChat,
  inactive = false,
}: {
  chat: Chat;
  onBack: () => void;
  onMenu: () => void;
  onOpenChat: (id: string) => void;
  inactive?: boolean;
}) {
  const [detail, setDetail] = useState<ChatDetail | null>(null);
  const detailOpen = detail !== null;
  const { settings } = usePreferences();
  const { typing, setActiveChat, markRead, snowballEvent } = useDemo();
  useEffect(() => {
    setActiveChat(inactive || detailOpen ? null : chat.id);
    if (!inactive && !detailOpen) markRead(chat.id);
    return () => setActiveChat(null);
  }, [chat.id, setActiveChat, markRead, inactive, detailOpen]);
  const scroller = useRef<HTMLDivElement>(null);
  const members = chatMembers(chat, contacts);
  const typingPeople = settings.showTyping
    ? members.filter(
        (member) =>
          member.privacy.showTyping && typing[chat.id]?.includes(member.id),
      )
    : [];
  const isTyping = typingPeople.length > 0;
  useEffect(() => {
    if (scroller.current)
      scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [chat.id, chat.messages.length, isTyping]);
  return (
    <section className="chat-panel" aria-label={`Conversa com ${chat.name}`}>
      {snowballEvent?.chatId === chat.id && (
        <div
          key={snowballEvent.id}
          className="snowball-burst"
          aria-hidden="true"
        >
          <span>❄️</span>
          <i>✧</i>
          <i>✦</i>
        </div>
      )}
      <header className="chat-panel-header">
        <button
          className="icon-button mobile-only"
          onClick={onBack}
          aria-label="Abrir lista de conversas"
        >
          <ArrowLeft size={22} />
        </button>
        <Avatar name={chat.name} color={chat.color} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">
            <button
              className="contact-title"
              title={
                chat.kind === "group"
                  ? "Ver participantes do grupo"
                  : "Ver perfil do contato"
              }
              onClick={() =>
                setDetail(
                  chat.kind === "group"
                    ? { kind: "group" }
                    : { kind: "contact", contactId: chat.memberIds[0] },
                )
              }
            >
              {chat.name}
            </button>
          </h2>
          <p className="mt-1 truncate text-xs text-[var(--muted)]">
            {chat.kind === "group"
              ? chat.group?.selfMember
                ? `${groupMemberIds(chat).length} participantes fictícios · você incluído`
                : "Você saiu deste grupo"
              : contacts.find((contact) => contact.id === chat.memberIds[0])
                  ?.status}
          </p>
        </div>
        <span className="automation-tag">
          <Bot size={14} aria-hidden="true" />
          <span className="hidden sm:inline">Teste</span>
        </span>
        <Link
          href="/configuracoes"
          className="icon-button shrink-0"
          aria-label="Abrir configurações"
          title="Configurações"
        >
          <Settings size={21} />
        </Link>
        <button
          className="icon-button shrink-0"
          onClick={onMenu}
          aria-label="Abrir menu do chat"
        >
          <MoreHorizontal size={23} />
        </button>
      </header>
      <div
        ref={scroller}
        className="message-scroller"
        data-testid="message-scroller"
      >
        <div className="mb-6 text-center">
          <span className="rounded-lg bg-[var(--panel)] px-3 py-1.5 text-[10px] text-[var(--muted)]">
            {chat.kind === "person"
              ? "CONVERSA PRIVADA · DEMONSTRAÇÃO"
              : "MENSAGENS PARA O GRUPO · DEMONSTRAÇÃO"}
          </span>
        </div>
        <div
          role="log"
          aria-label="Mensagens de teste"
          aria-live="polite"
          aria-relevant="additions"
          className="space-y-3"
        >
          {chat.messages.length === 0 && (
            <p className="mx-auto max-w-xs rounded-2xl bg-[var(--panel)] p-5 text-center text-sm leading-relaxed text-[var(--muted)]">
              Tudo pronto! Envie a primeira mensagem para receber uma resposta
              automática de teste.
            </p>
          )}
          {chat.messages.map((message) => {
            const readers = settings.readReceipts
              ? visibleReaders(chat, message, contacts)
              : [];
            return (
              <article
                key={message.id}
                className={`message-bubble ${message.kind === "snowball" ? "snowball-message" : ""} ${!message.text && message.attachments.length === 1 && message.attachments[0].sticker ? "sticker-bubble" : ""} ${message.outgoing ? "message-outgoing" : "message-incoming"}`}
                aria-label={
                  message.outgoing ? "Sua mensagem" : "Mensagem de demonstração"
                }
              >
                {!message.outgoing && message.author && (
                  <p className="mb-1 text-xs font-semibold text-[var(--accent)]">
                    {message.author}
                  </p>
                )}
                {message.attachments.map((attachment) => (
                  <AttachmentPreview
                    key={attachment.id}
                    attachment={attachment}
                  />
                ))}
                {message.text && (
                  <p className="message-text whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]">
                    {message.text}
                  </p>
                )}
                <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[var(--muted)]">
                  <time>{message.time}</time>
                  {message.outgoing &&
                    (settings.readReceipts ? (
                      <button
                        className="receipt-button"
                        aria-label={`Ver quem viu a mensagem: ${message.text.slice(0, 50) || "Anexo"}`}
                        onClick={() =>
                          setDetail({ kind: "receipt", messageId: message.id })
                        }
                      >
                        {readers.length ? (
                          <CheckCheck size={14} />
                        ) : (
                          <Check size={13} />
                        )}
                        <span>
                          {readers.length
                            ? chat.kind === "group"
                              ? `${readers.length}/${members.length} viram`
                              : "Vista"
                            : "Enviada"}
                        </span>
                      </button>
                    ) : (
                      <Check size={12} aria-label="Adicionada localmente" />
                    ))}
                </div>
              </article>
            );
          })}
        </div>
        {isTyping && <TypingIndicator people={typingPeople} />}
      </div>
      {chat.kind !== "group" || chat.group?.selfMember ? (
        <Composer key={chat.id} chatId={chat.id} />
      ) : (
        <p className="group-left-banner" role="status">
          Você saiu do grupo. Envio de mensagens indisponível.
        </p>
      )}
      {detail && (
        <ChatDetailsDialog
          chat={chat}
          detail={detail}
          onClose={() => setDetail(null)}
          onDetail={setDetail}
          onOpenChat={onOpenChat}
        />
      )}
    </section>
  );
}
