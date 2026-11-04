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
  Check,
  CheckCheck,
  MessageCircle,
  Plus,
  Search,
  Settings,
  Users,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createDemoId } from "@/lib/demo-id";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
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
  const pending = useRef<Pending | null>(null),
    loaded = useRef<ChatMessage[]>([]),
    active = useRef<string | null>(null),
    scroller = useRef<HTMLDivElement>(null),
    sticky = useRef(true),
    typing = useRef({ value: false, at: 0, sent: 0 });
  const seenThreads = useRef<Map<string, string> | null>(null);
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
      const { data, error } = await client.rpc("menchat_list_chats");
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
        "Não foi possível atualizar as conversas. Confira a conexão e aplique a migração 5.",
      );
      return null;
    }
  }, [client, notifyIncoming, selectThread, userId]);
  useEffect(() => {
    let alive = true,
      running = false;
    async function run() {
      if (!alive || running) return;
      running = true;
      await refreshThreads();
      running = false;
    }
    void run();
    const timer = setInterval(() => void run(), 3000);
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
    async function refresh() {
      if (running) return;
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
        const latest = loaded.current.at(-1)?.seq || 0;
        await client.rpc("menchat_touch", {
          p_thread: selected,
          p_received: latest,
          p_read:
            !document.hidden && document.hasFocus() && sticky.current
              ? latest
              : 0,
          p_typing:
            typing.current.value && Date.now() - typing.current.at < 4000,
        });
        const roster = await client.rpc("menchat_participants", {
          p_thread: selected,
        });
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
  }, [messages]);
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
  async function send(text: string, file: File | null): Promise<boolean> {
    if (busy || !selected || !thread?.can_send) return false;
    const target = selected;
    const old = pending.current;
    const item: Pending =
      old?.text === text && old.thread === target && old.file === file
        ? old
        : { id: createDemoId(), text, thread: target, file };
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
          existing.data.attachment_id === item.upload.id
        )
          sent = existing.data;
      }
      if (!sent && file) {
        item.upload ??= await reserveUpload(client, target, file);
        await uploadFile(client, item.upload, file);
        const result = await client.rpc("menchat_send_upload", {
          p_message: item.id,
          p_upload: item.upload.id,
          p_body: text,
        });
        if (!result.error) {
          const result = await client
            .from("menchat_messages")
            .select("*")
            .eq("id", item.id)
            .maybeSingle<ChatMessage>();
          sent = result.data;
        }
      } else if (!sent) {
        const result = await client
          .from("menchat_messages")
          .insert({
            id: item.id,
            thread_id: target,
            sender_id: userId,
            body: text,
          })
          .select("*")
          .single<ChatMessage>();
        sent = result.data;
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
          existing.data.attachment_id === (item.upload?.id || null)
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
              className="icon-button"
              aria-label="Configurações"
            >
              <Settings size={20} />
            </Link>
            <Link
              href="/conta/perfil"
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
        <footer className="real-list-footer">
          <Link href="/conta/perfil" className="min-w-0 flex-1">
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
                  <span className="real-typing" role="status">
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
              <Link
                href="/conta/configuracoes"
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
                      {!mine && thread.kind === "group" && (
                        <p className="mb-1 text-xs font-semibold text-[var(--accent)]">
                          {author?.name || "Participante anterior"}
                        </p>
                      )}
                      {m.attachment_id && (
                        <RealMedia client={client} id={m.attachment_id} />
                      )}
                      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                        {m.body}
                      </p>
                      <div className="real-message-meta">
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
            </div>
            <RealComposer
              key={selected}
              disabled={!thread.can_send}
              busy={busy}
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
