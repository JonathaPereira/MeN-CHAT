"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  MessageCircle,
  Plus,
  Search,
  UserRound,
  Settings,
  BellOff,
  Bell,
  Users,
} from "lucide-react";
import { useIsDesktop } from "@/lib/hooks/use-is-desktop";
import { Modal } from "@/components/modal";
import { usePreferences } from "@/components/preferences-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/avatar";
import { useDemo } from "@/components/demo-provider";
import { ChatPanel } from "@/components/chat/chat-panel";
import { NewChatDialog } from "@/components/chat/new-chat-dialog";

export function ConversationList() {
  const { profile, chats, markRead } = useDemo();
  const isDesktop = useIsDesktop();
  const [selectedId, setSelectedId] = useState("assistant-chat");
  const [listOpen, setListOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { settings, update } = usePreferences();
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
    setListOpen(false);
    markRead(id);
  }
  return (
    <div className="messenger-shell">
      <main
        id="conteudo"
        className="messenger-main"
        data-text-size={settings.textSize}
      >
        <h1 className="sr-only">M&N CHAT</h1>
        <aside
          className={`conversation-sidebar ${listOpen ? "mobile-list-active" : ""}`}
          aria-label="Lista de conversas"
        >
          <div className="sidebar-heading">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">
                Conversas
              </h2>
              <div className="flex gap-1">
                <button
                  className="icon-button"
                  onClick={() => {
                    setListOpen(false);
                    setDialog("private");
                  }}
                  aria-label="Nova conversa por código"
                  title="Nova conversa"
                >
                  <Plus size={22} />
                </button>
                <button
                  className="icon-button"
                  onClick={() => {
                    setListOpen(false);
                    setDialog("group");
                  }}
                  aria-label="Criar grupo"
                  title="Criar grupo"
                >
                  <Users size={21} />
                </button>
                <Link
                  href="/configuracoes"
                  className="icon-button"
                  aria-label="Configurações da aplicação"
                  title="Configurações"
                >
                  <Settings size={20} />
                </Link>
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
                            {chat.kind === "group" && !chat.group?.selfMember
                              ? "Você saiu do grupo · "
                              : last?.outgoing
                                ? "Você: "
                                : ""}
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
        <div className={`chat-area ${listOpen ? "mobile-chat-hidden" : ""}`}>
          {selected ? (
            <ChatPanel
              chat={selected}
              onBack={() => setListOpen(true)}
              onMenu={() => setMenuOpen(true)}
              onOpenChat={openChat}
              inactive={(!isDesktop && listOpen) || menuOpen || Boolean(dialog)}
            />
          ) : (
            <section className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-[var(--muted)]">
              <MessageCircle size={44} />
              <h2 className="text-xl font-semibold">Vamos conversar?</h2>
              <p className="text-sm">Escolha uma conversa para começar.</p>
            </section>
          )}
        </div>
      </main>
      {menuOpen && (
        <Modal title="Menu do chat" onClose={() => setMenuOpen(false)}>
          <div className="space-y-2">
            <Link href="/perfil" className="menu-action">
              <Avatar name={profile.name} photo={profile.photo} />
              <span>Meu perfil · {profile.name}</span>
            </Link>
            <Link href="/configuracoes" className="menu-action">
              <Settings size={20} />
              Configurações
            </Link>
            <button
              className="menu-action"
              onClick={() => {
                setMenuOpen(false);
                setDialog("private");
              }}
            >
              <Plus size={20} />
              Nova conversa por código
            </button>
            <button
              className="menu-action"
              onClick={() => {
                setMenuOpen(false);
                setDialog("group");
              }}
            >
              <Users size={20} />
              Criar grupo
            </button>
            {selected && (
              <button
                className="menu-action"
                onClick={() => {
                  update({
                    mutedChatIds: settings.mutedChatIds.includes(selected.id)
                      ? settings.mutedChatIds.filter((id) => id !== selected.id)
                      : [...settings.mutedChatIds, selected.id],
                  });
                  setMenuOpen(false);
                }}
              >
                {settings.mutedChatIds.includes(selected.id) ? (
                  <Bell size={20} />
                ) : (
                  <BellOff size={20} />
                )}
                {settings.mutedChatIds.includes(selected.id)
                  ? "Reativar avisos desta conversa"
                  : "Silenciar esta conversa"}
              </button>
            )}
            <div className="flex items-center justify-between border-t border-[var(--line)] pt-4">
              <span className="text-sm text-[var(--muted)]">Aparência</span>
              <ThemeToggle />
            </div>
            <p className="demo-note mt-4">
              Modo de teste com respostas automáticas. Nenhuma pessoa real está
              conectada.
            </p>
          </div>
        </Modal>
      )}
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
