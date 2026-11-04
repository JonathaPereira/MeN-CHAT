"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { ArrowLeft, Send, Plus, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createDemoId } from "@/lib/demo-id";
import { Brand } from "@/components/brand";
type Thread = { id: string; name: string; can_send: boolean };
type Message = {
  id: string;
  seq: number;
  sender_id: string;
  body: string;
  created_at: string;
  thread_id: string;
};
export function PrivateChat({
  userId,
  name,
  code,
}: {
  userId: string;
  name: string;
  code: string;
}) {
  const [client] = useState(() => createClient());
  const [threads, setThreads] = useState<Thread[]>([]),
    [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]),
    [text, setText] = useState(""),
    [search, setSearch] = useState("");
  const [error, setError] = useState(""),
    [connection, setConnection] = useState("Conectando…"),
    [busy, setBusy] = useState(false),
    [older, setOlder] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pending = useRef<{ id: string; text: string; thread: string } | null>(
    null,
  );
  const loaded = useRef<Message[]>([]),
    active = useRef<string | null>(null),
    scroller = useRef<HTMLDivElement>(null);
  const thread = threads.find((t) => t.id === selected);
  const sticky = useRef(true);
  const selectThread = useCallback((id: string | null) => {
    if (active.current === id) return;
    active.current = id;
    loaded.current = [];
    pending.current = null;
    sticky.current = true;
    setMessages([]);
    setOlder(false);
    setError("");
    setText("");
    setSelected(id);
  }, []);
  useEffect(() => {
    let alive = true;
    let running = false;
    async function refresh() {
      if (running) return;
      running = true;
      try {
        const { data, error } = await client.rpc("menchat_list_private");
        if (!alive) return;
        if (error) {
          setError(
            "Não foi possível carregar as conversas. Confira a conexão e a migração do chat.",
          );
          return;
        }
        const rows = (data || []) as Thread[];
        setThreads(rows);
        if (active.current && !rows.some((t) => t.id === active.current)) {
          selectThread(null);
        }
      } catch {
        if (alive) setError("Conexão indisponível. Tente novamente.");
      } finally {
        running = false;
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    window.addEventListener("focus", refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [client, selectThread]);
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    let running = false;
    function merge(rows: Message[]) {
      const map = new Map(loaded.current.map((m) => [m.id, m]));
      rows.forEach((m) => map.set(m.id, m));
      loaded.current = [...map.values()].sort((a, b) => a.seq - b.seq);
      setMessages(loaded.current);
    }
    async function refresh() {
      if (running) return;
      running = true;
      try {
        const last = loaded.current.at(-1)?.seq;
        if (last === undefined) {
          const { data, error } = await client
            .from("menchat_messages")
            .select("*")
            .eq("thread_id", selected)
            .order("seq", { ascending: false })
            .limit(50);
          if (!alive) return;
          if (error) {
            setError(
              "Histórico indisponível. Verifique sua sessão e a conexão.",
            );
            return;
          }
          const rows = (data || []) as Message[];
          merge(rows);
          setOlder(rows.length === 50);
        } else {
          let cursor = last;
          for (let batch = 0; batch < 20 && alive; batch++) {
            const { data, error } = await client
              .from("menchat_messages")
              .select("*")
              .eq("thread_id", selected)
              .gt("seq", cursor)
              .order("seq")
              .limit(100);
            if (!alive) return;
            if (error) {
              setError("Não foi possível atualizar o histórico.");
              return;
            }
            const rows = (data || []) as Message[];
            merge(rows);
            if (rows.length < 100) break;
            cursor = rows.at(-1)!.seq;
          }
        }
      } catch {
        if (alive) setError("Conexão indisponível. Tente novamente.");
      } finally {
        running = false;
      }
    }
    const channel = client
      .channel(`private-messages-${selected}`)
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
            ? "Ao vivo"
            : status === "CHANNEL_ERROR" || status === "TIMED_OUT"
              ? "Reconectando · atualização periódica"
              : "Conectando…",
        );
        if (status === "SUBSCRIBED") void refresh();
      });
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    window.addEventListener("focus", refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      void client.removeChannel(channel);
    };
  }, [client, selected]);
  useEffect(() => {
    if (scroller.current && sticky.current)
      scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages]);
  async function open(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await client.rpc("menchat_open_private", {
        p_code: search.trim().toUpperCase(),
      });
      if (error || !data) {
        setError(
          "Perfil indisponível ou limite de busca atingido. Confira o código e aguarde antes de tentar outra vez.",
        );
        return;
      }
      const list = await client.rpc("menchat_list_private");
      if (list.error) {
        setError("Não foi possível atualizar a lista.");
        return;
      }
      setThreads(list.data as Thread[]);
      selectThread(String(data));
      setSearch("");
      setSearchOpen(false);
    } catch {
      setError("Não foi possível abrir a conversa.");
    } finally {
      setBusy(false);
    }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (busy || !selected || !thread?.can_send || !text.trim()) return;
    const currentThread = selected;
    const body = text.trim();
    const item =
      pending.current?.text === body && pending.current.thread === currentThread
        ? pending.current
        : { id: createDemoId(), text: body, thread: currentThread };
    pending.current = item;
    setBusy(true);
    setError("");
    try {
      const result = await client
        .from("menchat_messages")
        .insert({
          id: item.id,
          thread_id: currentThread,
          sender_id: userId,
          body,
        })
        .select("*")
        .single<Message>();
      if (active.current !== currentThread) return;
      let sent = result.data;
      if (result.error?.code === "23505") {
        const existing = await client
          .from("menchat_messages")
          .select("*")
          .eq("id", item.id)
          .maybeSingle<Message>();
        if (
          existing.data?.sender_id === userId &&
          existing.data.thread_id === currentThread &&
          existing.data.body === body
        )
          sent = existing.data;
      }
      if (!sent) {
        setError(
          "Envio não confirmado. Seu texto foi mantido; tente enviar novamente.",
        );
        return;
      }
      const map = new Map(loaded.current.map((m) => [m.id, m]));
      map.set(sent.id, sent);
      loaded.current = [...map.values()].sort((a, b) => a.seq - b.seq);
      setMessages(loaded.current);
      pending.current = null;
      setText("");
      requestAnimationFrame(() => {
        if (scroller.current)
          scroller.current.scrollTop = scroller.current.scrollHeight;
      });
    } catch {
      if (active.current === currentThread)
        setError(
          "Envio não confirmado. Tente novamente sem alterar o texto para evitar duplicatas.",
        );
    } finally {
      setBusy(false);
    }
  }
  async function history() {
    if (!selected || !loaded.current.length || busy) return;
    setBusy(true);
    const target = selected;
    try {
      const { data, error } = await client
        .from("menchat_messages")
        .select("*")
        .eq("thread_id", target)
        .lt("seq", loaded.current[0].seq)
        .order("seq", { ascending: false })
        .limit(50);
      if (active.current !== target) return;
      if (error) {
        setError("Não foi possível carregar mensagens anteriores.");
        return;
      }
      const map = new Map(loaded.current.map((m) => [m.id, m]));
      (data as Message[]).forEach((m) => map.set(m.id, m));
      loaded.current = [...map.values()].sort((a, b) => a.seq - b.seq);
      sticky.current = false;
      setMessages(loaded.current);
      setOlder(data.length === 50);
    } catch {
      if (active.current === target)
        setError("Não foi possível carregar mensagens anteriores.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="real-chat" id="conteudo">
      <aside
        className={`real-chat-list ${selected ? "real-list-hidden" : ""}`}
        aria-label="Conversas privadas reais"
      >
        <header className="flex items-center justify-between gap-3 p-5">
          <Brand />
          <Link href="/conta" className="secondary-button">
            Conta
          </Link>
        </header>
        <div className="px-5 pb-4">
          <p className="text-sm">{name}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Seu código: <code>{code}</code>
          </p>
          <button
            className="secondary-button mt-4 w-full"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <Plus size={16} />
            Nova conversa por código
          </button>
          {searchOpen && (
            <form onSubmit={open} className="mt-3 space-y-2">
              <label htmlFor="real-code" className="field-label">
                Código do contato
              </label>
              <input
                id="real-code"
                className="field uppercase"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                required
                pattern="[A-Za-z0-9]{6}"
                maxLength={6}
              />
              <button className="primary-button w-full" disabled={busy}>
                Abrir conversa
              </button>
            </form>
          )}
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto p-3">
          {threads.map((t) => (
            <button
              key={t.id}
              className="real-thread"
              aria-current={t.id === selected ? "page" : undefined}
              onClick={() => selectThread(t.id)}
            >
              {t.name}
              {!t.can_send && (
                <span className="block text-xs">Somente leitura</span>
              )}
            </button>
          ))}
          {!threads.length && (
            <p className="p-3 text-sm text-[var(--muted)]">
              Encontre uma pessoa já cadastrada pelo código para começar.
            </p>
          )}
        </nav>
      </aside>
      <section
        className={`real-chat-panel ${!selected ? "real-panel-hidden" : ""}`}
        aria-label="Mensagens privadas reais"
      >
        <header className="flex items-center gap-3 border-b border-[var(--line)] p-4">
          <button
            className="icon-button mobile-only"
            aria-label="Voltar às conversas"
            onClick={() => selectThread(null)}
          >
            <ArrowLeft />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold">
              {thread?.name || "Conversas privadas"}
            </h1>
            <p className="text-xs text-[var(--muted)]">
              {selected ? connection : "Selecione um contato à esquerda"}
            </p>
          </div>
          <Link href="/conta" className="icon-button" aria-label="Minha conta">
            <UserRound size={18} />
          </Link>
        </header>
        <div
          ref={scroller}
          onScroll={() => {
            const node = scroller.current;
            if (node)
              sticky.current =
                node.scrollHeight - node.scrollTop - node.clientHeight < 180;
          }}
          className="real-message-list"
          role="log"
          aria-label="Histórico privado"
          aria-live="polite"
        >
          {older && (
            <button
              className="secondary-button mx-auto mb-4"
              onClick={() => void history()}
              disabled={busy}
            >
              Carregar anteriores
            </button>
          )}
          {messages.map((m) => (
            <article
              className={`message-bubble mb-3 ${m.sender_id === userId ? "message-outgoing" : "message-incoming"}`}
              key={m.id}
            >
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                {m.body}
              </p>
              <time className="mt-1 block text-right text-[10px] text-[var(--muted)]">
                {new Date(m.created_at).toLocaleString("pt-BR")}
              </time>
            </article>
          ))}
          {selected && !messages.length && (
            <p className="p-4 text-center text-sm text-[var(--muted)]">
              Comece a conversa. As mensagens ficam salvas na sua conta.
            </p>
          )}
        </div>
        {selected && (
          <form
            onSubmit={send}
            className="flex gap-2 border-t border-[var(--line)] p-4"
          >
            <label htmlFor="real-message" className="sr-only">
              Mensagem privada
            </label>
            <textarea
              id="real-message"
              className="field min-w-0 flex-1"
              rows={1}
              maxLength={4000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!thread?.can_send}
              placeholder={
                thread?.can_send ? "Mensagem…" : "Este contato não está ativo"
              }
            />
            <button
              className="send-button"
              disabled={busy || !text.trim() || !thread?.can_send}
              aria-label="Enviar mensagem privada"
            >
              <Send size={19} />
            </button>
          </form>
        )}
      </section>
      {error && (
        <div role="alert" className="real-chat-error">
          {error}
          <button className="ml-4 underline" onClick={() => setError("")}>
            Fechar
          </button>
        </div>
      )}
    </main>
  );
}
