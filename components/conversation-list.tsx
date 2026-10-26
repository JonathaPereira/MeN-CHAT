"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Check,
  MessageCircle,
  Plus,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/avatar";
import { useDemo } from "@/components/demo-provider";
import { ChatPanel } from "@/components/chat/chat-panel";
import { NewChatDialog } from "@/components/chat/new-chat-dialog";

export function ConversationList() {
  const { profile, chats, markRead } = useDemo();
  const [selectedId, setSelectedId] = useState("assistant-chat");
  const [mobileChat, setMobileChat] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "groups">("all");
  const [dialog, setDialog] = useState<"private" | "group" | null>(null);
  const selected = chats.find((chat) => chat.id === selectedId);
  const filtered = chats.filter(
    (chat) =>
      chat.name
        .toLocaleLowerCase("pt-BR")
        .includes(query.trim().toLocaleLowerCase("pt-BR")) &&
      (filter !== "unread" || chat.unread > 0) &&
      (filter !== "groups" || chat.kind === "group"),
  );
  function openChat(id: string) {
    setSelectedId(id);
    setMobileChat(true);
    markRead(id);
  }
  return (
    <div className="messenger-shell">
      <header className="app-header">
        <Link href="/conversas" aria-label="M&N CHAT, conversas">
          <Brand />
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />
          <Link
            href="/perfil"
            className="profile-link"
            aria-label="Abrir meu perfil"
          >
            <Avatar name={profile.name} photo={profile.photo} />
            <span className="hidden max-w-32 truncate text-sm font-medium sm:block">
              {profile.name}
            </span>
          </Link>
        </div>
      </header>
      <div className="demo-strip">
        <Bot size={15} className="shrink-0" aria-hidden="true" />
        <p>
          Modo de teste · Respostas automáticas, sem outras pessoas conectadas.
        </p>
      </div>
      <main id="conteudo" className="messenger-main">
        <aside
          className={`conversation-sidebar ${mobileChat ? "hidden md:flex" : "flex"}`}
          aria-label="Lista de conversas"
        >
          <div className="sidebar-heading">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Conversas
              </h1>
              <div className="flex gap-1">
                <button
                  className="icon-button"
                  onClick={() => setDialog("private")}
                  aria-label="Nova conversa por código"
                  title="Nova conversa"
                >
                  <Plus size={22} />
                </button>
                <button
                  className="icon-button"
                  onClick={() => setDialog("group")}
                  aria-label="Criar grupo"
                  title="Criar grupo"
                >
                  <Users size={21} />
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Seu círculo, sempre por perto.
            </p>
            <div className="relative mt-5">
              <label htmlFor="search" className="sr-only">
                Buscar conversas pelo nome
              </label>
              <Search size={17} className="field-icon" aria-hidden="true" />
              <input
                id="search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar conversa"
                className="field bg-[var(--canvas)] pl-11"
              />
            </div>
            <div className="mt-4 flex gap-2" aria-label="Filtrar conversas">
              {(
                [
                  { id: "all", label: "Todas" },
                  { id: "unread", label: "Não lidas" },
                  { id: "groups", label: "Grupos" },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  className={`filter-chip ${filter === item.id ? "filter-active" : ""}`}
                  onClick={() => setFilter(item.id)}
                  aria-pressed={filter === item.id}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="conversation-scroll">
            <ul aria-label="Resultados da busca">
              {filtered.map((chat) => {
                const last = chat.messages.at(-1);
                return (
                  <li key={chat.id}>
                    <button
                      onClick={() => openChat(chat.id)}
                      className={`conversation-row ${selectedId === chat.id ? "conversation-active" : ""}`}
                      aria-current={selectedId === chat.id ? "true" : undefined}
                    >
                      <Avatar name={chat.name} color={chat.color} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold">
                            {chat.name}
                          </span>
                          <span className="shrink-0 text-[10px] text-[var(--muted)]">
                            {last?.time}
                          </span>
                        </span>
                        <span className="mt-1.5 flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-[var(--muted)]">
                            {last?.outgoing && "Você: "}
                            {last?.text ||
                              (last?.attachments.length
                                ? "📎 Anexo local"
                                : "Comece uma conversa de teste")}
                          </span>
                          {chat.unread > 0 ? (
                            <span
                              className="unread-count"
                              aria-label={`${chat.unread} mensagens fictícias não lidas`}
                            >
                              {chat.unread}
                            </span>
                          ) : last?.outgoing ? (
                            <Check
                              size={13}
                              className="shrink-0 text-[var(--muted)]"
                              aria-hidden="true"
                            />
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {!filtered.length && (
              <p
                role="status"
                className="p-8 text-center text-sm text-[var(--muted)]"
              >
                Nenhuma conversa encontrada.
              </p>
            )}
          </div>
          <footer className="sidebar-footer">
            <Link
              href="/perfil"
              className="flex min-h-10 items-center gap-2 text-xs text-[var(--accent)]"
            >
              <UserRound size={16} />
              Meu perfil
            </Link>
            <Link
              href="/login"
              className="flex min-h-10 items-center gap-1 text-xs text-[var(--muted)]"
            >
              <ArrowLeft size={14} />
              Login
            </Link>
          </footer>
        </aside>
        <div
          className={`min-h-0 min-w-0 flex-1 ${mobileChat ? "flex" : "hidden md:flex"}`}
        >
          {selected ? (
            <ChatPanel chat={selected} onBack={() => setMobileChat(false)} />
          ) : (
            <section className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-[var(--muted)]">
              <MessageCircle size={44} />
              <h2 className="text-xl font-semibold">Vamos conversar?</h2>
              <p className="text-sm">Escolha uma conversa para começar.</p>
            </section>
          )}
        </div>
      </main>
      {dialog && (
        <NewChatDialog
          group={dialog === "group"}
          onClose={() => setDialog(null)}
          onOpen={openChat}
        />
      )}
    </div>
  );
}
