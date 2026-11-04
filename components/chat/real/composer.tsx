"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import {
  Paperclip,
  Send,
  Smile,
  X,
  FileText,
  Camera,
  AtSign,
  Reply,
} from "lucide-react";
import { CameraDialog } from "./camera";
import type { SendContext } from "@/lib/chat/composition";
import type { ChatMessage, Participant } from "@/lib/chat/types";
import { quotedText, mentionStart } from "@/lib/chat/composition";
import { VoiceRecorder } from "@/components/chat/voice-recorder";
import { Modal } from "@/components/modal";
import {
  validateAttachment,
  attachmentAccept,
  formatFileSize,
} from "@/lib/attachments";
import { usePreferences } from "@/components/preferences-provider";
export function RealComposer({
  disabled,
  busy,
  onSend,
  onTyping,
  onError,
  onDiscard,
  onOverlayChange,
  reply,
  onCancelReply,
  people,
  isGroup,
}: {
  disabled: boolean;
  busy: boolean;
  onSend: (
    text: string,
    file: File | null,
    context: SendContext,
  ) => Promise<boolean>;
  onTyping: (value: boolean) => void;
  onError: (error: string) => void;
  onDiscard: () => void;
  onOverlayChange: (value: boolean) => void;
  reply: ChatMessage | null;
  onCancelReply: () => void;
  people: Participant[];
  isGroup: boolean;
}) {
  const { settings } = usePreferences();
  const [text, setText] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [recording, setRecording] = useState(false),
    [emojis, setEmojis] = useState(false);
  const [camera, setCamera] = useState(false),
    [mentionMenu, setMentionMenu] = useState(false),
    [mentions, setMentions] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    onOverlayChange(camera || emojis);
    return () => onOverlayChange(false);
  }, [camera, emojis, onOverlayChange]);
  const input = useRef<HTMLInputElement>(null),
    field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const frame = requestAnimationFrame(() => setPreview(url));
    return () => {
      cancelAnimationFrame(frame);
      URL.revokeObjectURL(url);
    };
  }, [file]);
  async function send(event?: FormEvent, voice?: File) {
    event?.preventDefault();
    if (busy || disabled) return;
    const attachment = voice || file;
    if (!text.trim() && !attachment) return;
    if (voice) setFile(voice);
    onTyping(false);
    if (
      await onSend(text.trim(), attachment, {
        replyId: reply?.id || null,
        mentionIds: mentions
          .filter((p) => text.includes(`@${p.name}`))
          .map((p) => p.id)
          .sort(),
      })
    ) {
      setText("");
      setMentions([]);
      onCancelReply();
      setFile(null);
      setPreview("");
      field.current?.focus();
    }
  }
  function pick(value: File) {
    const result = validateAttachment(value);
    if (result.error) {
      onError(result.error);
      return;
    }
    onDiscard();
    setPreview("");
    setFile(value);
    onError("");
  }
  return (
    <div className="real-composer-wrap">
      {reply && (
        <div className="reply-draft">
          <Reply size={16} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">
              Respondendo a{" "}
              {people.find((p) => p.id === reply.sender_id)?.name ||
                "uma mensagem"}
            </p>
            <p className="truncate text-xs">
              {reply.deleted_at
                ? "Mensagem apagada."
                : quotedText(reply.body, !!reply.attachment_id)}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Cancelar resposta"
            onClick={onCancelReply}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {mentionMenu && isGroup && (
        <div className="mention-chooser" aria-label="Mencionar participante">
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              className="mention-option"
              onClick={() => {
                const at = field.current?.selectionStart ?? text.length;
                const before = text.slice(0, at);
                const start = mentionStart(
                  text,
                  at,
                  mentions.map((m) => m.name),
                );
                const insert = `@${p.name} `;
                setText(
                  (start >= 0
                    ? before.slice(0, start)
                    : before + (before.endsWith(" ") || !before ? "" : " ")) +
                    insert +
                    text.slice(at),
                );
                setMentions((v) => [
                  ...v.filter((m) => m.id !== p.id),
                  { id: p.id, name: p.name },
                ]);
                setMentionMenu(false);
                onTyping(true);
                field.current?.focus();
              }}
            >
              <AtSign size={15} />
              {p.name}
            </button>
          ))}
        </div>
      )}

      {file && (
        <div className="real-file-preview">
          {file.type.startsWith("image/") && preview ? (
            <Image
              unoptimized
              src={preview}
              alt="Prévia do anexo"
              width={64}
              height={64}
              className="h-14 w-14 rounded-lg object-cover"
            />
          ) : (
            <FileText size={25} />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{file.name}</p>
            <p className="text-xs text-[var(--muted)]">
              {formatFileSize(file.size)} · pronto para enviar
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Remover anexo"
            disabled={busy}
            onClick={() => {
              onDiscard();
              setFile(null);
              setPreview("");
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <form
        onSubmit={(event) => void send(event)}
        className={`real-composer ${recording ? "real-composer-recording" : ""}`}
      >
        <input
          ref={input}
          type="file"
          className="sr-only"
          aria-label="Selecionar anexo"
          accept={attachmentAccept}
          onChange={(e) => {
            const selected = e.target.files?.[0];
            e.target.value = "";
            if (selected) pick(selected);
          }}
        />
        {!recording && (
          <>
            <button
              type="button"
              className="icon-button"
              title="Anexar arquivo"
              aria-label="Anexar arquivo"
              disabled={disabled || busy}
              onClick={() => input.current?.click()}
            >
              <Paperclip size={21} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Câmera"
              disabled={disabled || busy}
              onClick={() => setCamera(true)}
            >
              <Camera size={21} />
            </button>
            {isGroup && (
              <button
                type="button"
                className="icon-button mention-button"
                aria-label="Mencionar participante"
                disabled={disabled || busy}
                onClick={() => setMentionMenu((v) => !v)}
              >
                <AtSign size={19} />
              </button>
            )}
            <button
              type="button"
              className="icon-button real-emoji-button"
              aria-label="Escolher emoji"
              disabled={disabled || busy}
              onClick={() => setEmojis(true)}
            >
              <Smile size={21} />
            </button>
            <label htmlFor="real-message" className="sr-only">
              Mensagem
            </label>
            <textarea
              ref={field}
              id="real-message"
              rows={1}
              className="real-message-input"
              placeholder={
                disabled ? "Conversa indisponível" : "Escreva uma mensagem…"
              }
              maxLength={4000}
              disabled={disabled || busy}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                onTyping(Boolean(e.target.value.trim()));
                setMentionMenu(
                  isGroup &&
                    mentionStart(
                      e.target.value,
                      e.target.selectionStart,
                      mentions.map((m) => m.name),
                    ) >= 0,
                );
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setMentionMenu(false);
                  return;
                }
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing &&
                  settings.enterToSend
                ) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
          </>
        )}
        {!disabled && !busy && !file && (
          <VoiceRecorder
            onBusyChange={setRecording}
            onError={onError}
            onSend={(voice) => void send(undefined, voice)}
          />
        )}
        {!recording && (
          <button
            type="submit"
            className="send-button shrink-0"
            aria-label="Enviar mensagem"
            disabled={disabled || busy || (!text.trim() && !file)}
          >
            <Send size={19} />
          </button>
        )}
      </form>
      <p className="real-composer-note">
        {busy
          ? "Enviando… mantenha esta conversa aberta."
          : "Fotos 5 MB · vídeos 25 MB · áudios e documentos 10 MB"}
      </p>
      {camera && (
        <CameraDialog onClose={() => setCamera(false)} onCapture={pick} />
      )}
      {emojis && (
        <Modal title="Emojis" onClose={() => setEmojis(false)}>
          <div className="grid grid-cols-6 gap-2">
            {"😀 😁 😂 🥹 😍 😎 🤔 😴 🫶 ❤️ 💚 🔥 🎮 👾 🤖 ✨ 🎉 👍 👏 🙏 🤣 🥳 🚀 ☕"
              .split(" ")
              .map((emoji) => (
                <button
                  key={emoji}
                  className="icon-button text-2xl"
                  aria-label={`Inserir ${emoji}`}
                  onClick={() => {
                    const start = field.current?.selectionStart ?? text.length;
                    setText(text.slice(0, start) + emoji + text.slice(start));
                    onTyping(true);
                    setEmojis(false);
                    requestAnimationFrame(() => {
                      field.current?.focus();
                      field.current?.setSelectionRange(
                        start + emoji.length,
                        start + emoji.length,
                      );
                    });
                  }}
                >
                  {emoji}
                </button>
              ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
