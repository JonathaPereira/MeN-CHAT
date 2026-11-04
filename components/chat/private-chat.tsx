"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  Check,
  CheckCheck,
  MessageCircle,
  Plus,
  Search,
  Settings,
  Users,
  UserRound,
  Star,
  Reply,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createDemoId } from "@/lib/demo-id";
import { RealSettings } from "./real/settings";
import { RealProfileForm } from "./real/profile-form";
import type { RealProfile } from "@/lib/chat/types";
import {
  quotedText,
  sameComposition,
  type SendContext,
} from "@/lib/chat/composition";
import { chatError } from "@/lib/chat/errors";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { MessageMenu } from "./real/message-menu";
import { InstallAppButton } from "@/components/install-app-button";
import { Modal } from "@/components/modal";
import { usePreferences } from "@/components/preferences-provider";
import type {
  ChatThread,
  ChatMessage,
  Participant,
  Upload,
} from "@/lib/chat/types";
import { reserveUpload, uploadFile, discardUpload } from "@/lib/chat/media";
import { RealAvatar } from "./real/avatar";
import { RealMedia } from "./real/media";
import { RealComposer } from "./real/composer";
import { CreateGroupDialog, GroupDialog } from "./real/group-dialog";
type Pending = {
  id: string;
  text: string;
  thread: string;
  file: File | null;
  upload?: Upload;
  context: SendContext;
};
export function PrivateChat({
  userId,
  name,
  code,
  avatarPath = null,
}: {
  userId: string;
  name: string;
  code: string;
  avatarPath?: string | null;
}) {
  const [client] = useState(() => createClient());
  const { settings, notifyIncoming } = usePreferences();
  const [threads, setThreads] = useState<ChatThread[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [messages, setMessages] = useState<ChatMessage[]>([]),
    [people, setPeople] = useState<Participant[]>([]);
  const [error, setError] = useState(""),
    [connection, setConnection] = useState("Conectando…"),
    [busy, setBusy] = useState(false),
    [older, setOlder] = useState(false),
    [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [codeInput, setCodeInput] = useState(""),
    [dialog, setDialog] = useState<"new" | "group" | "details" | null>(null),
    [receipt, setReceipt] = useState<ChatMessage | null>(null);
  const [composerOverlay, setComposerOverlay] = useState(false);
  const [reply, setReply] = useState<ChatMessage | null>(null),
    [starred, setStarred] = useState<string[]>([]),
    [starList, setStarList] = useState<ChatMessage[] | null>(null),
    [quotes, setQuotes] = useState<Map<string, ChatMessage | null>>(new Map()),
    [panel, setPanel] = useState<"settings" | "profile" | null>(null),
    [ownProfile, setOwnProfile] = useState<RealProfile | null>(null);
  const quoteCache = useRef(new Map<string, ChatMessage | null>()),
    viewingChat = useRef(true),
    lastTouch = useRef({ received: -1, read: -1, typing: false }),
    lastSeen = useRef(-1);
  const pending = useRef<Pending | null>(null),
    loaded = useRef<ChatMessage[]>([]),
    active = useRef<string | null>(null),
    scroller = useRef<HTMLDivElement>(null),
    sticky = useRef(true),
    typing = useRef({ value: false, at: 0, sent: 0 });
  const seenThreads = useRef<Map<string, string> | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [deleting, setDeleting] = useState<ChatMessage | null>(null);
  useEffect(() => {
    viewingChat.current =
      !panel &&
      !dialog &&
      !deleting &&
      !receipt &&
      !starList &&
      !composerOverlay;
  }, [panel, dialog, deleting, receipt, starList, composerOverlay]);
  const [welcome, setWelcome] = useState<{ name: string; code: string } | null>(
    null,
  );
  useEffect(() => {
    let live = true;
    void client.rpc("menchat_welcome").then(({ data }) => {
      if (live) setWelcome(data?.[0] || null);
    });
    return () => {
      live = false;
    };
  }, [client]);
  const thread = threads.find((t) => t.id === selected),
    others = people.filter((p) => p.id !== userId),
    typists = others.filter((p) => p.is_typing);
  const selectThread = useCallback(
    (id: string | null) => {
      if (active.current === id) return;
      const old = pending.current;
      if (old?.upload) void discardUpload(client, old.upload).catch(() => {});
      active.current = id;
      loaded.current = [];
      pending.current = null;
      sticky.current = true;
      typing.current = { value: false, at: 0, sent: 0 };
      setDialog(null);
      setDeleting(null);
      setStarList(null);
      lastSeen.current = -1;
      setReply(null);
      setStarred([]);
      quoteCache.current.clear();
      setQuotes(new Map());
      lastTouch.current = { received: -1, read: -1, typing: false };
      setMessages([]);
      setPeople([]);
      setOlder(false);
      setError("");
      setSelected(id);
      setReceipt(null);
    },
    [client],
  );
  useEffect(
    () => () => {
      const item = pending.current;
      if (item?.upload) void discardUpload(client, item.upload).catch(() => {});
    },
    [client],
  );
  const refreshThreads = useCallback(async () => {
    try {
      const { data, error } = await client.rpc("menchat_inbox");
      if (error) throw new Error();
      const rows = (data || []) as ChatThread[];
      const previous = seenThreads.current;
      seenThreads.current = new Map(rows.map((t) => [t.id, t.last_at]));
      if (previous)
        for (const t of rows) {
          if (
            t.last_body &&
            t.last_sender !== userId &&
            previous.get(t.id) !== t.last_at
          ) {
            notifyIncoming({
              chatId: t.id,
              title: t.name,
              text: t.last_body,
              away: active.current !== t.id || document.hidden,
            });
          }
        }
      setThreads(rows);
      setLoading(false);
      if (active.current && !rows.some((t) => t.id === active.current))
        selectThread(null);
      return rows;
    } catch {
      setLoading(false);
      setError(
        "Não foi possível atualizar as conversas. Verifique sua conexão ou tente novamente em instantes.",
      );
      return null;
    }
  }, [client, notifyIncoming, selectThread, userId]);
  useEffect(() => {
    let alive = true,
      running = false,
      lastRun = 0;
    async function run() {
      if (!alive || running) return;
      if (document.hidden && Date.now() - lastRun < 30000) return;
      lastRun = Date.now();
      running = true;
      await refreshThreads();
      running = false;
    }
    void run();
    const timer = setInterval(() => void run(), 5000);
    window.addEventListener("focus", run);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", run);
    };
  }, [refreshThreads]);
  const merge = useCallback((rows: ChatMessage[]) => {
    const map = new Map(loaded.current.map((m) => [m.id, m]));
    rows.forEach((m) => map.set(m.id, m));
    loaded.current = [...map.values()].sort((a, b) => a.seq - b.seq);
    setMessages(loaded.current);
  }, []);
  useEffect(() => {
    if (!selected) return;
    let alive = true,
      running = false;
    void client
      .rpc("menchat_starred", { p_thread: selected })
      .then(({ data, error }) => {
        if (alive && !error) setStarred(data || []);
      });
    async function refresh() {
      if (running || document.hidden) return;
      running = true;
      try {
        const last = loaded.current.at(-1)?.seq;
        let cursor = last;
        for (
          let batch = 0;
          batch < (last === undefined ? 1 : 20) && alive;
          batch++
        ) {
          let query = client
            .from("menchat_messages")
            .select("*")
            .eq("thread_id", selected);
          query =
            cursor === undefined
              ? query.order("seq", { ascending: false }).limit(50)
              : query.gt("seq", cursor).order("seq").limit(100);
          const { data, error } = await query;
          if (!alive) return;
          if (error) {
            setError(
              "Histórico indisponível. Verifique a conexão e seu acesso.",
            );
            return;
          }
          const rows = (data || []) as ChatMessage[];
          merge(rows);
          if (cursor === undefined) {
            setOlder(rows.length === 50);
            break;
          }
          if (rows.length < 100) break;
          cursor = rows.at(-1)!.seq;
        }
        // Só identificadores e tombstones: não baixar novamente todos os textos/mídias.
        const replyIds = [
          ...new Set(
            loaded.current.flatMap((m) => (m.reply_to ? [m.reply_to] : [])),
          ),
        ];
        const ids = [
          ...new Set([...loaded.current.map((m) => m.id), ...replyIds]),
        ];
        for (let start = 0; start < ids.length; start += 200) {
          const slice = ids.slice(start, start + 200);
          const current = await client
            .from("menchat_messages")
            .select("id,deleted_at")
            .in("id", slice);
          if (!alive) return;
          if (!current.error) {
            const rows = current.data as {
              id: string;
              deleted_at: string | null;
            }[];
            const visible = new Map(rows.map((row) => [row.id, row]));
            for (const id of replyIds.filter((id) => slice.includes(id)))
              if (!visible.has(id) || visible.get(id)?.deleted_at)
                quoteCache.current.set(id, null);
            loaded.current = loaded.current
              .filter((m) => !slice.includes(m.id) || visible.has(m.id))
              .map((m) =>
                visible.get(m.id)?.deleted_at
                  ? {
                      ...m,
                      deleted_at: visible.get(m.id)!.deleted_at,
                      body: "Mensagem apagada.",
                      attachment_id: null,
                    }
                  : m,
              );
            setMessages(loaded.current);
          }
        }
        const missing = replyIds.filter((id) => !quoteCache.current.has(id));
        for (let offset = 0; offset < missing.length; offset += 200) {
          const part = missing.slice(offset, offset + 200);
          const result = await client
            .from("menchat_messages")
            .select("*")
            .eq("thread_id", selected)
            .in("id", part);
          if (!alive) return;
          if (!result.error) {
            for (const id of part) quoteCache.current.set(id, null);
            for (const m of result.data as ChatMessage[])
              if (!m.deleted_at) quoteCache.current.set(m.id, m);
          }
        }
        setQuotes(new Map(quoteCache.current));
        const latest = loaded.current.at(-1)?.seq || 0;
        const read =
          !document.hidden &&
          document.hasFocus() &&
          sticky.current &&
          viewingChat.current && !document.querySelector("dialog[open]")
            ? latest
            : 0;
        const isTyping =
          typing.current.value && Date.now() - typing.current.at < 4000;
        const touch = lastTouch.current;
        const work: PromiseLike<unknown>[] = [];
        if (read > lastSeen.current)
          work.push(
            client
              .rpc("menchat_seen", { p_thread: selected, p_seq: read })
              .then((result) => {
                if (!result.error && active.current === selected)
                  lastSeen.current = read;
              }),
          );
        if (
          latest !== touch.received ||
          read > touch.read ||
          isTyping ||
          touch.typing !== isTyping
        )
          work.push(
            client
              .rpc("menchat_touch", {
                p_thread: selected,
                p_received: latest,
                p_read: read,
                p_typing: isTyping,
              })
              .then((result) => {
                if (!result.error && active.current === selected)
                  lastTouch.current = {
                    received: latest,
                    read: Math.max(read, touch.read),
                    typing: isTyping,
                  };
              }),
          );
        const [roster] = await Promise.all([
          client.rpc("menchat_participants", { p_thread: selected }),
          ...work,
        ]);
        if (alive && !roster.error)
          setPeople((roster.data || []) as Participant[]);
      } catch {
        if (alive)
          setError(
            "Conexão interrompida. A atualização será tentada novamente.",
          );
      } finally {
        running = false;
      }
    }
    const channel = client
      .channel(`messages-${selected}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "menchat_messages",
          filter: `thread_id=eq.${selected}`,
        },
        () => void refresh(),
      )
      .subscribe((status) => {
        if (!alive) return;
        setConnection(
          status === "SUBSCRIBED"
            ? "Sincronizado"
            : status === "CHANNEL_ERROR" || status === "TIMED_OUT"
              ? "Atualizando periodicamente"
              : "Conectando…",
        );
        if (status === "SUBSCRIBED") void refresh();
      });
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      void client.removeChannel(channel);
      void client
        .rpc("menchat_touch", {
          p_thread: selected,
          p_received: 0,
          p_read: 0,
          p_typing: false,
        })
        .then(
          () => {},
          () => {},
        );
    };
  }, [client, merge, selected]);
  useEffect(() => {
    if (scroller.current && sticky.current)
      scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages, typists.length]);
  function onTyping(value: boolean) {
    typing.current.value = value;
    typing.current.at = Date.now();
    if (!selected) return;
    if (value && Date.now() - typing.current.sent < 2000) return;
    typing.current.sent = Date.now();
    void client
      .rpc("menchat_touch", {
        p_thread: selected,
        p_received: loaded.current.at(-1)?.seq || 0,
        p_read: 0,
        p_typing: value,
      })
      .then(
        () => {},
        () => {},
      );
  }
  async function open(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await client.rpc("menchat_open_private", {
        p_code: codeInput.trim().toUpperCase(),
      });
      if (error || !data)
        throw new Error(
          "Perfil indisponível ou limite de busca atingido. Confira o código e tente novamente em um minuto.",
        );
      await refreshThreads();
      selectThread(String(data));
      setDialog(null);
      setCodeInput("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível abrir a conversa.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function send(
    text: string,
    file: File | null,
    context: SendContext,
  ): Promise<boolean> {
    if (busy || !selected || !thread?.can_send) return false;
    const target = selected;
    const old = pending.current;
    const item: Pending =
      old?.text === text &&
      old.thread === target &&
      old.file === file &&
      sameComposition(old.context, context)
        ? old
        : { id: createDemoId(), text, thread: target, file, context };
    if (old?.upload && old !== item)
      void discardUpload(client, old.upload).catch(() => {});
    pending.current = item;
    setBusy(true);
    setError("");
    try {
      let sent: ChatMessage | null = null;
      // A publicação anterior pode ter concluído mesmo que a resposta tenha se perdido.
      if (file && item.upload && old === item) {
        const existing = await client
          .from("menchat_messages")
          .select("*")
          .eq("id", item.id)
          .maybeSingle<ChatMessage>();
        if (
          existing.data?.sender_id === userId &&
          existing.data.thread_id === target &&
          existing.data.body === text &&
          existing.data.attachment_id === item.upload.id &&
          sameComposition(
            {
              replyId: existing.data.reply_to || null,
              mentionIds: existing.data.mention_ids || [],
            },
            context,
          )
        )
          sent = existing.data;
      }
      if (!sent && file) {
        item.upload ??= await reserveUpload(client, target, file);
        await uploadFile(client, item.upload, file);
        const result = await client.rpc("menchat_send_composed", {
          p_id: item.id,
          p_thread: target,
          p_reply: context.replyId,
          p_mentions: context.mentionIds,
          p_upload: item.upload.id,
          p_body: text,
        });
        if (!result.error) sent = result.data as ChatMessage;
      } else if (!sent) {
        const result = await client.rpc("menchat_send_composed", {
          p_id: item.id,
          p_thread: target,
          p_body: text,
          p_reply: context.replyId,
          p_mentions: context.mentionIds,
          p_upload: null,
        });
        if (!result.error) sent = result.data as ChatMessage;
        else if (result.error.code !== "23505")
          throw new Error(
            chatError(result.error, "Envio não confirmado. Tente novamente."),
          );
      }
      if (!sent) {
        const existing = await client
          .from("menchat_messages")
          .select("*")
          .eq("id", item.id)
          .maybeSingle<ChatMessage>();
        if (
          existing.data?.sender_id === userId &&
          existing.data.thread_id === target &&
          existing.data.body === text &&
          existing.data.attachment_id === (item.upload?.id || null) &&
          sameComposition(
            {
              replyId: existing.data.reply_to || null,
              mentionIds: existing.data.mention_ids || [],
            },
            context,
          )
        )
          sent = existing.data;
      }
      if (!sent)
        throw new Error(
          "Envio não confirmado. O conteúdo foi mantido; tente novamente sem alterá-lo.",
        );
      if (active.current === target) {
        merge([sent]);
        pending.current = null;
        sticky.current = true;
        requestAnimationFrame(() => {
          if (scroller.current)
            scroller.current.scrollTop = scroller.current.scrollHeight;
        });
      }
      void fetch("/api/push/dispatch", { method: "POST", keepalive: true }).catch(() => {});
      void refreshThreads();
      return true;
    } catch (error) {
      if (active.current === target)
        setError(
          error instanceof Error
            ? error.message
            : "Falha ao enviar. Tente novamente.",
        );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function history() {
    if (!selected || !loaded.current.length || busy) return;
    const target = selected,
      node = scroller.current,
      oldHeight = node?.scrollHeight || 0,
      oldTop = node?.scrollTop || 0;
    setBusy(true);
    try {
      const { data, error } = await client
        .from("menchat_messages")
        .select("*")
        .eq("thread_id", target)
        .lt("seq", loaded.current[0].seq)
        .order("seq", { ascending: false })
        .limit(50);
      if (active.current !== target) return;
      if (error) throw new Error();
      sticky.current = false;
      merge((data || []) as ChatMessage[]);
      setOlder(data.length === 50);
      requestAnimationFrame(() => {
        if (node) node.scrollTop = oldTop + node.scrollHeight - oldHeight;
      });
    } catch {
      setError("Não foi possível carregar mensagens anteriores.");
    } finally {
      setBusy(false);
    }
  }
  async function refreshDetails() {
    const rows = await refreshThreads();
    if (selected && rows?.some((t) => t.id === selected)) {
      const result = await client.rpc("menchat_participants", {
        p_thread: selected,
      });
      if (!result.error) setPeople(result.data as Participant[]);
    }
  }
  async function openProfile() {
    setPanel("profile");
    setError("");
    setOwnProfile(null);
    const result = await client
      .from("menchat_profiles")
      .select(
        "id,display_name,user_code,status_message,avatar_path,show_code,allow_code_lookup,read_receipts,show_typing",
      )
      .eq("id", userId)
      .single<RealProfile>();
    if (result.error) setError("Não foi possível carregar o perfil.");
    else setOwnProfile(result.data);
  }
  async function markMessage(m: ChatMessage) {
    const adding = !starred.includes(m.id);
    const result = await client.rpc("menchat_star_message", {
      p_id: m.id,
      p_star: adding,
    });
    if (result.error) {
      setError("Não foi possível marcar a mensagem.");
      return false;
    }
    setStarred((v) => (adding ? [...v, m.id] : v.filter((id) => id !== m.id)));
    setDeleting(null);
    return true;
  }
  async function showStars() {
    const ids = await client.rpc("menchat_starred", { p_thread: selected });
    if (ids.error) {
      setError("Não foi possível carregar as mensagens marcadas.");
      return;
    }
    const result = ids.data?.length
      ? await client
          .from("menchat_messages")
          .select("*")
          .in("id", ids.data)
          .order("seq", { ascending: false })
      : { data: [], error: null };
    if (result.error)
      setError("Não foi possível carregar as mensagens marcadas.");
    else setStarList(result.data as ChatMessage[]);
  }
  const visible = threads.filter(
    (t) =>
      (filter === "all" || t.kind === filter) &&
      t.name
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  return (
    <main className={`real-chat real-text-${settings.textSize}`} id="conteudo">
      <aside
        className={`real-chat-list ${selected ? "real-list-hidden" : ""}`}
        aria-label="Conversas reais"
      >
        <header className="real-list-header">
          <Brand />
          <div className="flex items-center gap-1">
            <Link
              href="/conta/configuracoes"
              prefetch={false}
              onClick={(e) => {
                if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                  e.preventDefault();
                  setPanel("settings");
                }
              }}
              className="icon-button"
              aria-label="Configurações"
            >
              <Settings size={20} />
            </Link>
            <Link
              href="/conta/perfil"
              prefetch={false}
              onClick={(e) => {
                if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                  e.preventDefault();
                  void openProfile();
                }
              }}
              className="icon-button"
              aria-label="Meu perfil"
            >
              <RealAvatar client={client} name={name} path={avatarPath} />
            </Link>
          </div>
        </header>
        <div className="real-list-tools">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight">Conversas</h1>
            <div className="flex gap-1">
              <button
                className="icon-button"
                aria-label="Nova conversa por código"
                title="Nova conversa"
                onClick={() => setDialog("new")}
              >
                <Plus size={21} />
              </button>
              <button
                className="icon-button"
                aria-label="Criar grupo"
                title="Criar grupo"
                onClick={() => setDialog("group")}
              >
                <Users size={20} />
              </button>
            </div>
          </div>
          <label className="real-search">
            <Search size={17} />
            <span className="sr-only">Buscar conversa</span>
            <input
              placeholder="Buscar conversa"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div
            className="flex gap-2"
            role="group"
            aria-label="Filtrar conversas"
          >
            {[
              ["all", "Todas"],
              ["private", "Pessoas"],
              ["group", "Grupos"],
            ].map(([value, label]) => (
              <button
                key={value}
                className="filter-pill"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {welcome && (
          <div className="welcome-inviter">
            <p>{welcome.name} convidou você.</p>
            <p>
              Código: <strong>{welcome.code}</strong>
            </p>
            <button
              className="secondary-button"
              onClick={async () => {
                const result = await client.rpc("menchat_open_private", {
                  p_code: welcome.code,
                });
                if (result.data) {
                  await refreshThreads();
                  selectThread(String(result.data));
                  setWelcome(null);
                } else
                  setError(
                    "Não foi possível iniciar a conversa. Confira a conexão e tente novamente.",
                  );
              }}
            >
              Conversar com {welcome.name.split(" ")[0]}
            </button>
          </div>
        )}
        <nav
          className="min-h-0 flex-1 overflow-y-auto p-2"
          aria-label="Lista de conversas"
        >
          {visible.map((t) => (
            <button
              key={t.id}
              className="real-thread"
              aria-current={t.id === selected ? "page" : undefined}
              disabled={busy}
              onClick={() => selectThread(t.id)}
            >
              {t.kind === "group" ? (
                <span className="avatar avatar-sage">
                  <Users size={21} />
                </span>
              ) : (
                <RealAvatar
                  client={client}
                  name={t.name}
                  path={t.avatar_path}
                />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-semibold">
                    {t.name}
                  </span>
                  <time className="ml-auto shrink-0 text-[10px] text-[var(--muted)]">
                    {new Date(t.last_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </span>
                <span className="mt-1 block truncate text-xs text-[var(--muted)]">
                  {t.can_send
                    ? t.last_body || "Comece a conversar"
                    : "Somente leitura"}
                </span>
              </span>
              {!!t.unread_count && (
                <span
                  className="unread-badge"
                  aria-label={`${t.unread_count} mensagens não lidas`}
                >
                  {t.unread_count > 99 ? "99+" : t.unread_count}
                </span>
              )}
            </button>
          ))}
          {!visible.length && (
            <p className="p-5 text-center text-sm leading-relaxed text-[var(--muted)]">
              {loading
                ? "Carregando conversas…"
                : search
                  ? "Nenhuma conversa encontrada."
                  : "Crie um grupo só seu para começar ou encontre uma conta ativa pelo código."}
            </p>
          )}
        </nav>
        <div className="install-list-entry"><InstallAppButton /></div>
        <footer className="real-list-footer">
          <Link
            href="/conta/perfil"
            prefetch={false}
            onClick={(e) => {
              if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                e.preventDefault();
                void openProfile();
              }
            }}
            className="min-w-0 flex-1"
          >
            <p className="truncate text-xs font-semibold">{name}</p>
            <span className="text-[10px] text-[var(--muted)]">
              Seu código: {code}
            </span>
          </Link>
          <ThemeToggle />
          <Link href="/conta" className="icon-button" aria-label="Minha conta">
            <UserRound size={18} />
          </Link>
        </footer>
      </aside>
      <section
        className={`real-chat-panel ${!selected ? "real-panel-hidden" : ""}`}
        aria-label="Mensagens reais"
      >
        {thread ? (
          <>
            <header className="real-conversation-header">
              <button
                className="icon-button mobile-only"
                aria-label="Voltar às conversas"
                onClick={() => selectThread(null)}
                disabled={busy}
              >
                <ArrowLeft size={21} />
              </button>
              <button
                className="real-contact-button"
                onClick={() => setDialog("details")}
                aria-label={`Ver detalhes de ${thread.name}`}
              >
                {thread.kind === "group" ? (
                  <span className="avatar avatar-sage">
                    <Users size={21} />
                  </span>
                ) : (
                  <RealAvatar
                    client={client}
                    name={thread.name}
                    path={thread.avatar_path}
                  />
                )}
                <span className="min-w-0">
                  <h2 className="truncate text-sm font-semibold">
                    {thread.name}
                  </h2>
                  <span className="real-typing">
                    {typists.length ? (
                      <>
                        <span className="typing-dots">
                          <i />
                          <i />
                          <i />
                        </span>
                        <span className="real-typing-faces">
                          {typists.slice(0, 3).map((p) => (
                            <RealAvatar
                              key={p.id}
                              client={client}
                              name={p.name}
                              path={p.avatar_path}
                            />
                          ))}
                        </span>
                        {typists.map((p) => p.name.split(" ")[0]).join(", ")}{" "}
                        digitando…
                      </>
                    ) : thread.kind === "group" ? (
                      `${people.length} ${people.length === 1 ? "participante" : "participantes"} · ${connection}`
                    ) : (
                      others[0]?.status || connection
                    )}
                  </span>
                </span>
              </button>
              <button
                className="icon-button"
                aria-label="Mensagens marcadas"
                onClick={() => void showStars()}
              >
                <Star size={19} />
              </button>
              <Link
                href="/conta/configuracoes"
                prefetch={false}
                onClick={(e) => {
                  if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                    e.preventDefault();
                    setPanel("settings");
                  }
                }}
                className="icon-button"
                aria-label="Configurações da aplicação"
              >
                <Settings size={19} />
              </Link>
            </header>
            <div
              ref={scroller}
              className="real-message-list"
              role="log"
              aria-label="Histórico da conversa"
              aria-live="polite"
              onScroll={() => {
                const node = scroller.current;
                if (node)
                  sticky.current =
                    node.scrollHeight - node.scrollTop - node.clientHeight < 90;
              }}
            >
              {older && (
                <button
                  className="secondary-button mx-auto mb-5"
                  disabled={busy}
                  onClick={() => void history()}
                >
                  Carregar anteriores
                </button>
              )}
              {!messages.length && (
                <p className="real-history-note">
                  Comece a conversa. Mensagens e anexos ficam salvos na sua
                  conta.
                </p>
              )}
              {messages.map((m, index) => {
                const mine = m.sender_id === userId,
                  author = people.find((p) => p.id === m.sender_id);
                const delivered =
                    others.length > 0 &&
                    others.every((p) => p.received_seq >= m.seq),
                  read =
                    others.length > 0 &&
                    others.every(
                      (p) => p.shares_read && (p.read_seq || 0) >= m.seq,
                    );
                const day = new Date(m.created_at).toLocaleDateString("pt-BR");
                const before = index
                  ? new Date(messages[index - 1].created_at).toLocaleDateString(
                      "pt-BR",
                    )
                  : null;
                return (
                  <div key={m.id}>
                    {day !== before && (
                      <div className="real-date">
                        <span>{day}</span>
                      </div>
                    )}
                    <article
                      className={`message-bubble real-message ${mine ? "message-outgoing" : "message-incoming"}`}
                    >
                      <button type="button" className="message-options-arrow"
                        aria-label="Opções da mensagem" aria-haspopup="true"
                        aria-expanded={deleting?.id === m.id}
                        onClick={(e) => {
                          setMenuAnchor(e.currentTarget);
                          setError("");
                          setDeleting(deleting?.id === m.id ? null : m);
                        }}><ChevronDown size={18} aria-hidden="true" /></button>
                      {!mine && thread.kind === "group" && (
                        <p className="mb-1 text-xs font-semibold text-[var(--accent)]">
                          {author?.name || "Participante anterior"}
                        </p>
                      )}
                      {!m.deleted_at && m.reply_to && (
                        <blockquote className="message-quote">
                          <Reply size={13} />
                          <span>
                            {quotes.get(m.reply_to)
                              ? quotedText(
                                  quotes.get(m.reply_to)!.body,
                                  !!quotes.get(m.reply_to)!.attachment_id,
                                )
                              : "Mensagem indisponível"}
                          </span>
                        </blockquote>
                      )}
                      {!m.deleted_at && m.attachment_id && (
                        <RealMedia client={client} id={m.attachment_id} />
                      )}
                      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                        {m.body}
                      </p>
                      {!m.deleted_at && !!m.mention_ids?.length && (
                        <p className="message-mentions">
                          {m.mention_ids.map((id) => (
                            <span
                              key={id}
                              className={id === userId ? "mention-self" : ""}
                            >
                              @
                              {people.find((p) => p.id === id)?.name ||
                                "Participante"}
                            </span>
                          ))}
                        </p>
                      )}
                      <div className="real-message-meta">
                        {starred.includes(m.id) && !m.deleted_at && (
                          <Star size={12} aria-label="Mensagem marcada" />
                        )}
                        <time dateTime={m.created_at}>
                          {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                        {mine && (
                          <button
                            className={read ? "real-read" : ""}
                            aria-label="Ver confirmações da mensagem"
                            title={
                              read
                                ? "Lida"
                                : delivered
                                  ? "Recebida"
                                  : "Salva no servidor"
                            }
                            onClick={() => setReceipt(m)}
                          >
                            {delivered ? (
                              <CheckCheck size={15} />
                            ) : (
                              <Check size={15} />
                            )}
                          </button>
                        )}
                      </div>
                    </article>
                  </div>
                );
              })}
              {!!typists.length && (
                <div
                  className="chat-typing-bubble"
                  role="status"
                  aria-label="Digitação na conversa"
                >
                  {typists.slice(0, 3).map((p) => (
                    <RealAvatar
                      key={p.id}
                      client={client}
                      name={p.name}
                      path={p.avatar_path}
                    />
                  ))}
                  <span>
                    {typists.map((p) => p.name.split(" ")[0]).join(", ")}{" "}
                    {typists.length > 1 ? "estão digitando" : "está digitando"}…
                  </span>
                  <span className="typing-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              )}
            </div>
            <RealComposer
              key={selected}
              disabled={!thread.can_send}
              busy={busy}
              onOverlayChange={setComposerOverlay}
              reply={reply}
              onCancelReply={() => setReply(null)}
              people={people}
              isGroup={thread.kind === "group"}
              onSend={send}
              onTyping={onTyping}
              onDiscard={() => {
                const item = pending.current;
                pending.current = null;
                if (item?.upload)
                  void discardUpload(client, item.upload).catch(() => {});
              }}
              onError={setError}
            />
          </>
        ) : (
          <div className="real-chat-welcome">
            <Brand large />
            <div className="real-welcome-mark">
              <MessageCircle size={42} strokeWidth={1.2} />
            </div>
            <h2>Seu espaço de conversa</h2>
            <p>
              Abra uma conversa ou crie um grupo.
              <br />O MenChat mantém tudo em um só lugar.
            </p>
            <button
              className="secondary-button"
              onClick={() => setDialog("group")}
            >
              <Users size={17} /> Criar meu primeiro grupo
            </button>
          </div>
        )}
      </section>
      {dialog === "new" && (
        <Modal title="Nova conversa" onClose={() => setDialog(null)}>
          <form onSubmit={open} className="space-y-4">
            <label htmlFor="real-code" className="field-label">
              Código do contato
            </label>
            <input
              id="real-code"
              className="field uppercase"
              required
              maxLength={6}
              pattern="[A-Za-z0-9]{6}"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
            />
            <button className="primary-button w-full" disabled={busy}>
              Abrir conversa
            </button>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <p className="text-xs text-[var(--muted)]">
              O código encontra uma conta ativa; não convida novas pessoas.
            </p>
          </form>
        </Modal>
      )}
      {dialog === "group" && (
        <CreateGroupDialog
          client={client}
          onClose={() => setDialog(null)}
          onCreated={async (id) => {
            await refreshThreads();
            selectThread(id);
          }}
        />
      )}
      {dialog === "details" &&
        thread &&
        (thread.kind === "group" ? (
          <GroupDialog
            client={client}
            thread={thread}
            people={people}
            userId={userId}
            onClose={() => setDialog(null)}
            onChange={refreshDetails}
          />
        ) : (
          <Modal title="Perfil do contato" onClose={() => setDialog(null)}>
            {others.map((p) => (
              <div key={p.id} className="space-y-3">
                <RealAvatar
                  client={client}
                  name={p.name}
                  path={p.avatar_path}
                />
                <h3 className="font-semibold">{p.name}</h3>
                <p className="text-sm">{p.status || "Sem status"}</p>
                <p className="text-xs text-[var(--muted)]">
                  {p.code ? `Código: ${p.code}` : "Código oculto pelo contato"}
                </p>
              </div>
            ))}
          </Modal>
        ))}
      {deleting && menuAnchor && (
        <MessageMenu key={deleting.id} anchor={menuAnchor} onClose={() => setDeleting(null)}>
          {error && (
            <p role="alert" className="form-error mb-3">
              {error}
            </p>
          )}
          {!deleting.deleted_at && (
            <>
              <button
                className="message-menu-item"
                onClick={() => {
                  setReply(deleting);
                  setDeleting(null);
                  requestAnimationFrame(() =>
                    document.getElementById("real-message")?.focus({ preventScroll: true }),
                  );
                }}
              >
                <Reply size={17} />
                Responder
              </button>
              <button
                className="message-menu-item"
                onClick={() => void markMessage(deleting)}
              >
                <Star size={17} />
                {starred.includes(deleting.id)
                  ? "Desmarcar mensagem"
                  : "Marcar mensagem"}
              </button>
            </>
          )}
          {[
            false,
            ...(deleting.sender_id === userId && !deleting.deleted_at
              ? [true]
              : []),
          ].map((everyone) => (
            <button
              key={String(everyone)}
              className="message-menu-item"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await client.rpc("menchat_delete_message", {
                    p_id: deleting.id,
                    p_everyone: everyone,
                  });
                  if (result.error) throw new Error();
                  if (everyone)
                    merge([
                      {
                        ...deleting,
                        body: "Mensagem apagada.",
                        attachment_id: null,
                        deleted_at: new Date().toISOString(),
                      },
                    ]);
                  else {
                    loaded.current = loaded.current.filter(
                      (m) => m.id !== deleting.id,
                    );
                    setMessages(loaded.current);
                  }
                  setDeleting(null);
                  void refreshThreads();
                } catch {
                  setError(
                    "Não foi possível apagar. Confira sua permissão e tente novamente.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {everyone ? "Apagar para todos" : "Apagar para mim"}
            </button>
          ))}
        </MessageMenu>
      )}
      {panel && (
        <Modal
          title={panel === "settings" ? "Configurações" : "Meu perfil"}
          onClose={() => setPanel(null)}
        >
          {panel === "settings" ? (
            <RealSettings
              onClose={() => setPanel(null)}
              onProfile={() => void openProfile()}
            />
          ) : ownProfile ? (
            <RealProfileForm profile={ownProfile} />
          ) : error ? (
            <p role="alert" className="form-error">
              {error}
              <button
                className="secondary-button mt-3"
                onClick={() => void openProfile()}
              >
                Tentar novamente
              </button>
            </p>
          ) : (
            <p role="status">Carregando perfil…</p>
          )}
        </Modal>
      )}
      {starList && (
        <Modal title="Mensagens marcadas" onClose={() => setStarList(null)}>
          {!starList.length ? (
            <p>Nenhuma mensagem marcada nesta conversa.</p>
          ) : (
            <ul className="space-y-3">
              {starList.map((m) => (
                <li key={m.id} className="starred-item">
                  <p className="text-sm">
                    {quotedText(m.body, !!m.attachment_id)}
                  </p>
                  <button
                    className="secondary-button mt-2"
                    onClick={() => {
                      setReply(m);
                      setStarList(null);
                    }}
                  >
                    Responder
                  </button>
                  <button
                    className="secondary-button ml-2 mt-2"
                    onClick={async () => {
                      if (await markMessage(m))
                        setStarList(
                          (v) => v?.filter((row) => row.id !== m.id) || [],
                        );
                    }}
                  >
                    Desmarcar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
      {receipt && (
        <Modal
          title="Confirmações da mensagem"
          onClose={() => setReceipt(null)}
        >
          <p className="mb-4 text-xs text-[var(--muted)]">
            Salva no servidor. Recebimento e leitura dependem da confirmação dos
            outros aparelhos.
          </p>
          <ul className="space-y-4">
            {others.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <RealAvatar
                  client={client}
                  name={p.name}
                  path={p.avatar_path}
                />
                <div>
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {!p.shares_read
                      ? "Leitura não compartilhada"
                      : (p.read_seq || 0) >= receipt.seq
                        ? "Lida"
                        : p.received_seq >= receipt.seq
                          ? "Recebida"
                          : "Ainda não confirmada"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {!others.length && (
            <p className="text-sm">Esta conversa tem apenas você.</p>
          )}
        </Modal>
      )}
      {error && (
        <div role="alert" className="real-chat-error">
          {error}
          <button className="ml-3 underline" onClick={() => setError("")}>
            Fechar
          </button>
        </div>
      )}
    </main>
  );
}
