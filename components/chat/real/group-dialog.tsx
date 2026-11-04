"use client";
import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatThread, Participant } from "@/lib/chat/types";
import { Modal } from "@/components/modal";
import { RealAvatar } from "./avatar";
export function CreateGroupDialog({
  client,
  onClose,
  onCreated,
}: {
  client: SupabaseClient;
  onClose: () => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState(""),
    [codes, setCodes] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const list = [
        ...new Set(
          codes
            .split(/[\s,;]+/)
            .filter(Boolean)
            .map((c) => c.toUpperCase()),
        ),
      ];
      if (list.length > 19 || list.some((c) => !/^[A-Z0-9]{6}$/.test(c)))
        throw new Error("Use até 19 códigos de seis letras/números.");
      const { data, error } = await client.rpc("menchat_create_group", {
        p_name: name.trim(),
        p_codes: list,
      });
      if (error || !data)
        throw new Error(
          "Não foi possível criar. Confira os códigos e suas permissões e tente novamente.",
        );
      await onCreated(String(data));
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Falha ao criar grupo.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Criar grupo" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <label className="field-label" htmlFor="group-name">
          Nome do grupo
        </label>
        <input
          id="group-name"
          className="field"
          required
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
        <label className="field-label" htmlFor="group-codes">
          Códigos dos participantes (opcional)
        </label>
        <textarea
          id="group-codes"
          className="field"
          rows={3}
          maxLength={160}
          value={codes}
          onChange={(e) => setCodes(e.target.value)}
          disabled={busy}
          placeholder="Um código por linha"
        />
        <p className="text-xs text-[var(--muted)]">
          Somente contas já ativas. Sem códigos, você cria um grupo só seu para
          testar ou guardar mensagens.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="primary-button w-full" disabled={busy}>
          {busy ? "Criando…" : "Criar grupo"}
        </button>
      </form>
    </Modal>
  );
}
export function GroupDialog({
  client,
  thread,
  people,
  userId,
  onClose,
  onChange,
}: {
  client: SupabaseClient;
  thread: ChatThread;
  people: Participant[];
  userId: string;
  onClose: () => void;
  onChange: () => Promise<void>;
}) {
  const [code, setCode] = useState(""),
    [name, setName] = useState(thread.name),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState<{
      action: string;
      id?: string;
      name: string;
    } | null>(null);
  const admin = people.find((p) => p.id === userId)?.role === "admin",
    owner = thread.owner_id === userId;
  async function run(action: string, id?: string) {
    setBusy(true);
    setError("");
    try {
      const result = await client.rpc("menchat_manage_group", {
        p_thread: thread.id,
        p_action: action,
        p_user: id || null,
        p_code: code.trim().toUpperCase() || null,
        p_name: name.trim(),
      });
      if (result.error || !result.data)
        throw new Error(
          action === "leave"
            ? "Para sair, o proprietário precisa transferir o grupo se houver outros participantes."
            : "Ação indisponível. Confira seu papel, o código e as regras do criador/proprietário.",
        );
      setCode("");
      setConfirm(null);
      await onChange();
      if (action === "leave") onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Não foi possível atualizar.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Detalhes do grupo" onClose={onClose}>
      <div className="space-y-5">
        <p className="text-xs text-[var(--muted)]">
          {people.length} participante(s) · quem entra vê o histórico; sair ou
          ser removido encerra o acesso.
        </p>
        {confirm && (
          <div
            className="rounded-xl border border-[var(--line)] p-3"
            role="alert"
            tabIndex={-1}
            ref={(node) => node?.focus()}
          >
            <p className="mb-3 text-sm">
              {confirm.action === "remove"
                ? `Remover ${confirm.name}?`
                : confirm.action === "transfer"
                  ? `Transferir o grupo para ${confirm.name}?`
                  : "Sair deste grupo?"}
            </p>
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => void run(confirm.action, confirm.id)}
            >
              Confirmar
            </button>
            <button
              className="secondary-button ml-2"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Cancelar
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {admin && (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run("rename");
              }}
              className="space-y-2"
            >
              <label htmlFor="rename-group" className="field-label">
                Nome do grupo
              </label>
              <input
                id="rename-group"
                className="field"
                maxLength={60}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button className="secondary-button" disabled={busy}>
                Salvar nome
              </button>
            </form>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run("add");
              }}
              className="space-y-2"
            >
              <label htmlFor="add-code" className="field-label">
                Adicionar por código
              </label>
              <input
                id="add-code"
                className="field uppercase"
                required
                pattern="[A-Za-z0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button className="secondary-button" disabled={busy}>
                Adicionar participante
              </button>
            </form>
          </>
        )}
        <ul className="space-y-4" aria-label="Participantes do grupo">
          {people.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-[var(--line)] p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <RealAvatar
                  client={client}
                  name={p.name}
                  path={p.avatar_path}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {p.name}
                    {p.id === userId ? " (você)" : ""}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {p.id === thread.creator_id ? "Criador · " : ""}
                    {p.id === thread.owner_id
                      ? "Proprietário"
                      : p.role === "admin"
                        ? "Administrador"
                        : "Membro"}
                  </p>
                  <p className="break-words text-xs">{p.status}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {p.code ? `Código: ${p.code}` : "Código oculto"}
                  </p>
                </div>
              </div>
              {admin && p.id !== userId && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.id !== thread.creator_id && p.id !== thread.owner_id && (
                    <>
                      {p.role === "member" ? (
                        <button
                          className="secondary-button text-xs"
                          disabled={busy}
                          onClick={() => void run("promote", p.id)}
                        >
                          Tornar admin
                        </button>
                      ) : (
                        owner && (
                          <button
                            className="secondary-button text-xs"
                            disabled={busy}
                            onClick={() => void run("demote", p.id)}
                          >
                            Remover admin
                          </button>
                        )
                      )}
                      {(owner || p.role === "member") && (
                        <button
                          className="secondary-button text-xs"
                          disabled={busy}
                          onClick={() =>
                            setConfirm({
                              action: "remove",
                              id: p.id,
                              name: p.name,
                            })
                          }
                        >
                          Remover
                        </button>
                      )}
                    </>
                  )}
                  {owner && (
                    <button
                      className="secondary-button text-xs"
                      disabled={busy}
                      onClick={() =>
                        setConfirm({
                          action: "transfer",
                          id: p.id,
                          name: p.name,
                        })
                      }
                    >
                      Transferir propriedade
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        <button
          className="secondary-button w-full text-[var(--danger)]"
          disabled={busy}
          onClick={() => setConfirm({ action: "leave", name: thread.name })}
        >
          Sair do grupo
        </button>
      </div>
    </Modal>
  );
}
