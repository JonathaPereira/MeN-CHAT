"use client";

import { useState, type FormEvent } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import { contacts } from "@/lib/data/chat";
import { normalizeUserCode } from "@/lib/user-code";
import { useDemo } from "@/components/demo-provider";
import { Modal } from "@/components/modal";
import { Avatar } from "@/components/avatar";

export function NewChatDialog({
  group,
  onClose,
  onOpen,
}: {
  group: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const { openPrivate, createGroup } = useDemo();
  const [code, setCode] = useState("");
  const [searched, setSearched] = useState(false);
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const found = searched
    ? contacts.find((contact) => contact.code === normalizeUserCode(code))
    : undefined;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (group) {
      if (name.trim().length < 2 || members.length < 1) {
        setError("Informe um nome e escolha pelo menos um participante.");
        return;
      }
      onOpen(createGroup(name, members));
      onClose();
    } else {
      setSearched(true);
    }
  }
  return (
    <Modal title={group ? "Criar grupo" : "Nova conversa"} onClose={onClose}>
      <p className="mb-5 text-sm leading-relaxed text-[var(--muted)]">
        {group
          ? "Dê um nome ao grupo e escolha os participantes fictícios. Você já está incluído."
          : "Encontre alguém pelo código de 6 letras e números. Teste A1B2C3 (Ana) ou BOT202 (assistente)."}
      </p>
      <form onSubmit={submit} className="space-y-5">
        {group ? (
          <>
            <div>
              <label htmlFor="group-name" className="field-label">
                Nome do grupo
              </label>
              <input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
                minLength={2}
                maxLength={60}
                className="field"
                placeholder="Ex.: Planos de fim de semana"
              />
            </div>
            <fieldset>
              <legend className="field-label">
                Participantes · {members.length + 1}/20
              </legend>
              <div className="space-y-2">
                {contacts.map((contact) => (
                  <label key={contact.id} className="contact-choice">
                    <Avatar name={contact.name} color={contact.color} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {contact.name}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {contact.code}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={members.includes(contact.id)}
                      onChange={(e) =>
                        setMembers((current) =>
                          e.target.checked
                            ? [...current, contact.id]
                            : current.filter((id) => id !== contact.id),
                        )
                      }
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        ) : (
          <div>
            <label htmlFor="contact-code" className="field-label">
              Código do usuário
            </label>
            <div className="flex gap-2">
              <input
                id="contact-code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setSearched(false);
                }}
                autoFocus
                required
                pattern="[A-Za-z0-9]{6}"
                minLength={6}
                maxLength={6}
                className="field min-w-0 flex-1 font-mono uppercase tracking-widest"
                placeholder="A1B2C3"
              />
              <button
                type="submit"
                className="primary-button"
                aria-label="Buscar usuário pelo código"
              >
                <Search size={19} />
              </button>
            </div>
          </div>
        )}
        {group && (
          <button type="submit" className="primary-button w-full">
            <Users size={18} />
            Criar grupo de teste
          </button>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </form>
      {!group && searched && (
        <div className="mt-5" role="status">
          {found ? (
            <div className="rounded-2xl border border-[var(--line)] p-4">
              <div className="mb-4 flex items-center gap-3">
                <Avatar name={found.name} color={found.color} />
                <div>
                  <p className="font-semibold">{found.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {found.status}
                  </p>
                </div>
              </div>
              <button
                className="primary-button w-full"
                onClick={() => {
                  onOpen(openPrivate(found));
                  onClose();
                }}
              >
                <UserPlus size={17} />
                Abrir conversa de teste
              </button>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Nenhum perfil fictício encontrado com este código.
            </p>
          )}
        </div>
      )}
      <p className="demo-note mt-5">
        Contatos e grupos de demonstração. Nenhum convite ou mensagem é enviado
        a outra pessoa.
      </p>
    </Modal>
  );
}
