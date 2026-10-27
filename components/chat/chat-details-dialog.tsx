"use client";

import { ArrowLeft, MessageCircle, Users, Eye } from "lucide-react";
import { Modal } from "@/components/modal";
import { ProfilePreview } from "@/components/profile-preview";
import { Avatar } from "@/components/avatar";
import { contacts } from "@/lib/data/chat";
import { chatMembers, profileCode, visibleReaders } from "@/lib/chat-privacy";
import { useDemo } from "@/components/demo-provider";
import { usePreferences } from "@/components/preferences-provider";
import type { Chat } from "@/types/chat";

export type ChatDetail =
  | { kind: "contact"; contactId: string }
  | { kind: "group" }
  | { kind: "receipt"; messageId: string };
export function ChatDetailsDialog({
  chat,
  detail,
  onClose,
  onDetail,
  onOpenChat,
}: {
  chat: Chat;
  detail: ChatDetail;
  onClose: () => void;
  onDetail: (detail: ChatDetail) => void;
  onOpenChat: (id: string) => void;
}) {
  const { openPrivate, profile } = useDemo();
  const { settings } = usePreferences();
  const members = chatMembers(chat, contacts);
  const contact =
    detail.kind === "contact"
      ? members.find((member) => member.id === detail.contactId)
      : undefined;
  const message =
    detail.kind === "receipt"
      ? chat.messages.find(
          (item) => item.id === detail.messageId && item.outgoing,
        )
      : undefined;
  const readers =
    message && settings.readReceipts
      ? visibleReaders(chat, message, contacts)
      : [];
  return (
    <Modal
      title={
        detail.kind === "receipt"
          ? "Quem viu"
          : detail.kind === "group"
            ? "Participantes do grupo"
            : "Perfil do contato"
      }
      onClose={onClose}
    >
      {contact && (
        <>
          {chat.kind === "group" && (
            <button
              className="mb-5 inline-flex min-h-9 items-center gap-2 text-xs text-[var(--accent)]"
              onClick={() => onDetail({ kind: "group" })}
            >
              <ArrowLeft size={15} />
              Voltar ao grupo
            </button>
          )}
          <ProfilePreview
            name={contact.name}
            status={contact.status}
            color={contact.color}
            code={profileCode(contact)}
          />
          <button
            className="primary-button mt-6 w-full"
            onClick={() => {
              const id = openPrivate(contact);
              onClose();
              onOpenChat(id);
            }}
          >
            <MessageCircle size={17} />
            Enviar mensagem
          </button>
        </>
      )}
      {detail.kind === "group" && (
        <>
          <div className="mb-6 flex items-center gap-3">
            <Users size={24} className="text-[var(--accent)]" />
            <div>
              <h3 className="font-semibold">{chat.name}</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Mensagens para os {members.length + 1} participantes ·
                demonstração
              </p>
            </div>
          </div>
          <ul className="space-y-2" aria-label="Participantes">
            <li className="contact-choice">
              <Avatar name={profile.name} photo={profile.photo} />
              <span className="text-sm font-medium">
                {profile.name}{" "}
                <span className="text-xs font-normal text-[var(--muted)]">
                  (você)
                </span>
              </span>
            </li>
            {members.map((member) => (
              <li key={member.id}>
                <button
                  className="contact-choice w-full text-left"
                  onClick={() =>
                    onDetail({ kind: "contact", contactId: member.id })
                  }
                >
                  <Avatar name={member.name} color={member.color} />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-medium">
                      {member.name}
                    </strong>
                    <span className="text-xs text-[var(--muted)]">
                      Ver perfil
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {detail.kind === "receipt" && (
        <>
          <div className="mb-5 rounded-xl bg-[var(--canvas)] p-3">
            <p className="text-xs text-[var(--muted)]">Sua mensagem</p>
            <p className="mt-1 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
              {message?.text || "Anexo"}
            </p>
          </div>
          {settings.readReceipts ? (
            <ul className="space-y-2" aria-label="Confirmações de leitura">
              {members.map((member) => {
                const receipt = readers.find(
                  (item) => item.contactId === member.id,
                );
                return (
                  <li key={member.id} className="contact-choice">
                    <Avatar name={member.name} color={member.color} />
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm font-medium">
                        {member.name}
                      </strong>
                      <span className="mt-1 block text-xs text-[var(--muted)]">
                        {receipt
                          ? `Viu às ${receipt.time}`
                          : member.privacy.readReceipts
                            ? "Sem confirmação"
                            : "Confirmação indisponível"}
                      </span>
                    </span>
                    {receipt && (
                      <Eye
                        size={17}
                        className="text-[var(--accent)]"
                        aria-label="Leitura simulada"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Confirmações de leitura desativadas nas suas opções de
              privacidade.
            </p>
          )}
          <p className="demo-note mt-5">
            Leituras simuladas para testar a interface. Somente participantes
            desta conversa aparecem aqui. Ainda não há outras pessoas
            conectadas.
          </p>
        </>
      )}
    </Modal>
  );
}
