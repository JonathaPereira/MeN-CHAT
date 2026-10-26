"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, Bot, Check } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { useDemo } from "@/components/demo-provider";
import { contacts } from "@/lib/data/chat";
import type { Chat } from "@/types/chat";
import { AttachmentPreview } from "./attachment-preview";
import { Composer } from "./composer";

export function ChatPanel({
  chat,
  onBack,
}: {
  chat: Chat;
  onBack: () => void;
}) {
  const { typing } = useDemo();
  const scroller = useRef<HTMLDivElement>(null);
  const isTyping = typing.includes(chat.id);
  useEffect(() => {
    if (scroller.current)
      scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [chat.id, chat.messages.length, isTyping]);
  return (
    <section className="chat-panel" aria-label={`Conversa com ${chat.name}`}>
      <header className="chat-panel-header">
        <button
          className="icon-button md:hidden"
          onClick={onBack}
          aria-label="Voltar à lista de conversas"
        >
          <ArrowLeft size={21} />
        </button>
        <Avatar name={chat.name} color={chat.color} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{chat.name}</h2>
          <p className="mt-1 truncate text-xs text-[var(--muted)]">
            {chat.kind === "group"
              ? `${chat.memberIds.length + 1} participantes fictícios · você incluído`
              : contacts.find((contact) => contact.id === chat.memberIds[0])
                  ?.status}
          </p>
        </div>
        <span className="automation-tag">
          <Bot size={14} aria-hidden="true" />
          <span className="hidden sm:inline">Teste</span>
        </span>
      </header>
      <div
        ref={scroller}
        className="message-scroller"
        data-testid="message-scroller"
      >
        <div className="mb-6 text-center">
          <span className="rounded-lg bg-[var(--panel)] px-3 py-1.5 text-[10px] text-[var(--muted)]">
            CONVERSA DE DEMONSTRAÇÃO
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
          {chat.messages.map((message) => (
            <article
              key={message.id}
              className={`message-bubble ${message.outgoing ? "message-outgoing" : "message-incoming"}`}
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
                <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">
                  {message.text}
                </p>
              )}
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[var(--muted)]">
                <time>{message.time}</time>
                {message.outgoing && (
                  <Check size={12} aria-label="Adicionada localmente" />
                )}
              </div>
            </article>
          ))}
        </div>
        {isTyping && (
          <p role="status" className="mt-4 text-xs text-[var(--accent)]">
            Assistente de teste digitando…
          </p>
        )}
      </div>
      <Composer key={chat.id} chatId={chat.id} />
    </section>
  );
}
