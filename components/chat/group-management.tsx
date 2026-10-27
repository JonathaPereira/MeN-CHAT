"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Crown, ShieldCheck, UserPlus, LogOut, Users } from "lucide-react";
import { useDemo } from "@/components/demo-provider";
import { Avatar } from "@/components/avatar";
import { contacts } from "@/lib/data/chat";
import { chatMembers, findContactByCode } from "@/lib/chat-privacy";
import {
  applyGroupAction,
  groupMemberIds,
  groupRole,
  isGroupAdmin,
  SELF,
  type GroupAction,
} from "@/lib/group-rules";
import type { Chat } from "@/types/chat";

export function GroupManagement({
  chat,
  onContact,
}: {
  chat: Chat;
  onContact: (id: string) => void;
}) {
  const { profile, manageGroup } = useDemo();
  const [code, setCode] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState<{
    action: GroupAction;
    label: string;
  } | null>(null);
  const confirmPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!confirmation) return;
    confirmPanel.current?.scrollIntoView({ block: "center" });
    confirmPanel.current?.focus({ preventScroll: true });
  }, [confirmation]);
  const members = chatMembers(chat, contacts);
  const active = Boolean(chat.group?.selfMember);
  const admin = isGroupAdmin(chat, SELF);
  const owner = chat.group?.ownerId === SELF;
  function allowed(action: GroupAction) {
    return applyGroupAction(chat, SELF, action).ok;
  }
  function run(action: GroupAction, success: string) {
    setError("");
    setNotice("");
    const result = manageGroup(chat.id, action);
    if (result) {
      setError(result);
      return;
    }
    setConfirmation(null);
    setNotice(success);
  }
  function invite(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    const contact = findContactByCode(code, contacts);
    if (!contact) {
      setError("Perfil não encontrado ou busca por código indisponível.");
      return;
    }
    const result = manageGroup(chat.id, { type: "add", targetId: contact.id });
    if (result) {
      setError(result);
      return;
    }
    setCode("");
    setNotice(`${contact.name} adicionado ao grupo de demonstração.`);
  }
  function leave() {
    setError("");
    setNotice("");
    const result = applyGroupAction(chat, SELF, { type: "leave" });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirmation({
      action: { type: "leave" },
      label: "Sair deste grupo? Ele ficará somente para consulta nesta aba.",
    });
  }
  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Users size={24} className="text-[var(--accent)]" />
        <div>
          <h3 className="font-semibold">{chat.name}</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Mensagens para os {groupMemberIds(chat).length} participantes ·
            demonstração
          </p>
        </div>
      </div>
      {!active && (
        <p className="demo-note mb-5">
          Você saiu deste grupo. O histórico local está disponível apenas para
          consulta; você não pode enviar mensagens ou gerenciar participantes.
        </p>
      )}
      {active && admin && (
        <p className="demo-note mb-4">
          {owner
            ? "Você é dono: pode remover membros e administradores, exceto o criador."
            : "Você é administrador: pode remover membros comuns. Somente o dono remove outros administradores; o criador é protegido."}{" "}
          Toque em Remover e confirme na caixa que será exibida.
        </p>
      )}
      <ul className="space-y-2" aria-label="Participantes">
        {active && (
          <li className="contact-choice">
            <Avatar name={profile.name} photo={profile.photo} />
            <span className="min-w-0 flex-1">
              <strong className="block text-sm font-medium">
                {profile.name} (você)
              </strong>
              <span className="group-role">
                <ShieldCheck size={12} />
                {groupRole(chat, SELF)}
              </span>
            </span>
          </li>
        )}
        {members.map((member) => (
          <li key={member.id} className="group-member-card">
            <button
              className="group-member-profile"
              onClick={() => onContact(member.id)}
            >
              <Avatar name={member.name} color={member.color} />
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm font-medium">
                  {member.name}
                </strong>
                <span className="group-role">
                  {chat.group?.creatorId === member.id ? (
                    <Crown size={12} />
                  ) : (
                    <ShieldCheck size={12} />
                  )}
                  {groupRole(chat, member.id)}
                </span>
              </span>
            </button>
            {chat.group?.creatorId === member.id && (
              <p className="px-3 pb-2 text-[10px] text-[var(--muted)]">
                Criador protegido contra remoção por outras pessoas.
              </p>
            )}
            {active && admin && (
              <div className="group-member-actions">
                {allowed({ type: "promote", targetId: member.id }) && (
                  <button
                    className="group-action"
                    aria-label={`Tornar ${member.name} administrador`}
                    onClick={() =>
                      run(
                        { type: "promote", targetId: member.id },
                        `${member.name} agora é administrador.`,
                      )
                    }
                  >
                    Tornar admin
                  </button>
                )}
                {allowed({ type: "demote", targetId: member.id }) && (
                  <button
                    className="group-action"
                    aria-label={`Revogar administrador ${member.name}`}
                    onClick={() =>
                      run(
                        { type: "demote", targetId: member.id },
                        `Permissão de administrador revogada para ${member.name}.`,
                      )
                    }
                  >
                    Revogar admin
                  </button>
                )}
                {allowed({ type: "remove", targetId: member.id }) && (
                  <button
                    className="group-action text-[var(--danger)]"
                    aria-label={`Remover ${member.name} do grupo`}
                    onClick={() =>
                      setConfirmation({
                        action: { type: "remove", targetId: member.id },
                        label: `Remover ${member.name} deste grupo?`,
                      })
                    }
                  >
                    Remover
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {active && admin && (
        <form
          onSubmit={invite}
          className="mt-6 rounded-2xl border border-[var(--line)] p-4"
        >
          <label htmlFor="group-user-code" className="field-label">
            Convidar por código de usuário
          </label>
          <p className="mb-3 text-xs leading-relaxed text-[var(--muted)]">
            Adicione um perfil fictício já cadastrado. Exemplo: P3D4R5 (Pedro).
            Não é um convite de cadastro ou link compartilhável.
          </p>
          <div className="flex gap-2">
            <input
              id="group-user-code"
              className="field min-w-0 flex-1 font-mono uppercase tracking-wider"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              required
              pattern="[A-Za-z0-9]{6}"
              maxLength={6}
              placeholder="P3D4R5"
            />
            <button
              type="submit"
              className="primary-button shrink-0"
              aria-label="Adicionar participante pelo código"
            >
              <UserPlus size={18} />
            </button>
          </div>
        </form>
      )}
      {active && !admin && (
        <p className="demo-note mt-5">
          Somente administradores podem convidar por código e gerenciar
          participantes.
        </p>
      )}
      {active && owner && members.length > 0 && (
        <section className="mt-5 rounded-2xl border border-[var(--line)] p-4">
          <h4 className="text-sm font-medium">Transferir propriedade</h4>
          <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
            Escolha outro dono antes de sair. O criador original continuará
            protegido contra remoção por qualquer outra pessoa.
          </p>
          <label htmlFor="group-next-owner" className="field-label mt-4">
            Novo dono
          </label>
          <select
            id="group-next-owner"
            className="field"
            value={transferTo}
            onChange={(event) => setTransferTo(event.target.value)}
          >
            <option value="">Selecione um participante</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
          <button
            className="secondary-button mt-3 w-full"
            disabled={!transferTo}
            onClick={() =>
              setConfirmation({
                action: { type: "transfer", targetId: transferTo },
                label:
                  "Transferir a propriedade? Você continuará no grupo como administrador.",
              })
            }
          >
            Transferir propriedade
          </button>
        </section>
      )}
      {confirmation && (
        <div
          ref={confirmPanel}
          tabIndex={-1}
          className="group-confirmation"
          role="alertdialog"
          aria-labelledby="group-confirmation-title"
        >
          <p id="group-confirmation-title" className="text-sm leading-relaxed">
            {confirmation.label}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              className="secondary-button"
              onClick={() => setConfirmation(null)}
            >
              Cancelar
            </button>
            <button
              className="primary-button"
              onClick={() =>
                run(
                  confirmation.action,
                  confirmation.action.type === "leave"
                    ? "Você saiu do grupo."
                    : confirmation.action.type === "transfer"
                      ? "Propriedade transferida."
                      : "Participante removido.",
                )
              }
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="form-error mt-4">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-sm text-[var(--accent)]">
          {notice}
        </p>
      )}
      {active && (
        <button
          className="secondary-button mt-6 w-full text-[var(--danger)]"
          onClick={leave}
        >
          <LogOut size={17} />
          Sair do grupo
        </button>
      )}
      <p className="demo-note mt-5">
        Gerenciamento local para testes. Alterações desaparecem ao recarregar. A
        proteção real dos grupos será validada no servidor.
      </p>
    </div>
  );
}
