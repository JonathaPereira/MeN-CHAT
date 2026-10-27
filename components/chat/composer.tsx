"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { File, Paperclip, Send, Smile, X } from "lucide-react";
import {
  attachmentAccept,
  MAX_ATTACHMENTS,
  validateAttachment,
  formatFileSize,
} from "@/lib/attachments";
import { ExpressionPicker } from "./expression-picker";
import { VoiceRecorder } from "./voice-recorder";
import { usePreferences } from "@/components/preferences-provider";
import { useDemo } from "@/components/demo-provider";
import { createDemoId } from "@/lib/demo-id";
import type { Attachment } from "@/types/chat";

export function Composer({ chatId }: { chatId: string }) {
  const { settings } = usePreferences();
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceError, setVoiceError] = useState(false);
  const audioInput = useRef<HTMLInputElement>(null);
  const { sendMessage, fileUrl, releaseUrl } = useDemo();
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const pendingRef = useRef<Attachment[]>([]);
  const [error, setError] = useState("");
  const [expressions, setExpressions] = useState(false);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      pendingRef.current.forEach((item) => releaseUrl(item.url));
    },
    [releaseUrl],
  );
  function changeFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    addFiles(files);
  }
  function addFiles(files: File[]) {
    if (files.length + attachments.length > MAX_ATTACHMENTS) {
      setError(`Anexe no máximo ${MAX_ATTACHMENTS} arquivos por mensagem.`);
      return;
    }
    const next: Attachment[] = [];
    const errors: string[] = [];
    for (const file of files) {
      const result = validateAttachment(file);
      if (result.error !== undefined) {
        errors.push(result.error);
        continue;
      }
      next.push({
        id: createDemoId(),
        name: file.name,
        size: file.size,
        kind: result.kind,
        url: fileUrl(file),
      });
    }
    const all = [...attachments, ...next];
    pendingRef.current = all;
    setAttachments(all);
    setError(errors.join(" "));
  }
  function remove(id: string) {
    const item = attachments.find((attachment) => attachment.id === id);
    if (item) releaseUrl(item.url);
    const next = attachments.filter((attachment) => attachment.id !== id);
    pendingRef.current = next;
    setAttachments(next);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (voiceBusy || (!text.trim() && !attachments.length)) return;
    sendMessage(chatId, text, attachments);
    pendingRef.current = [];
    setText("");
    setAttachments([]);
    setError("");
  }
  return (
    <div className="chat-composer">
      {attachments.length > 0 && (
        <ul className="mb-3 space-y-2" aria-label="Anexos selecionados">
          {attachments.map((item) => (
            <li
              key={item.id}
              className="flex min-w-0 items-center gap-2 rounded-xl bg-[var(--canvas)] p-2"
            >
              <File size={17} className="shrink-0 text-[var(--accent)]" />
              <span className="min-w-0 flex-1 truncate text-xs">
                {item.name} · {formatFileSize(item.size)}
              </span>
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="icon-button shrink-0"
                aria-label={`Remover ${item.name}`}
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="form-error mb-3">
          {error}
        </p>
      )}
      {voiceError && (
        <button
          type="button"
          className="secondary-button mb-3"
          onClick={() => audioInput.current?.click()}
        >
          Escolher áudio do aparelho
        </button>
      )}
      <input
        ref={audioInput}
        type="file"
        accept="audio/*"
        aria-label="Selecionar arquivo de áudio"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          changeFiles(event);
          setVoiceError(false);
        }}
      />
      {expressions && (
        <ExpressionPicker
          onClose={() => setExpressions(false)}
          onEmoji={(emoji) => {
            const field = messageInput.current;
            const start = field?.selectionStart ?? text.length;
            const end = field?.selectionEnd ?? start;
            const next = text.slice(0, start) + emoji + text.slice(end);
            if (next.length > 4000) {
              setError("A mensagem pode ter até 4000 caracteres.");
              setExpressions(false);
              return;
            }
            setText(next);
            setExpressions(false);
            requestAnimationFrame(() => {
              field?.focus();
              field?.setSelectionRange(
                start + emoji.length,
                start + emoji.length,
              );
            });
          }}
          onSticker={(sticker) => {
            sendMessage(chatId, "", [
              {
                id: createDemoId(),
                name: `${sticker.name}.webp`,
                kind: "image",
                sticker: true,
                size: sticker.size,
                url: sticker.dataUrl,
              },
            ]);
            setExpressions(false);
          }}
        />
      )}
      <form onSubmit={submit} className="composer-row">
        <input
          ref={input}
          type="file"
          accept={attachmentAccept}
          multiple
          onChange={changeFiles}
          className="sr-only"
          tabIndex={-1}
          aria-label="Selecionar anexos"
        />
        <button
          type="button"
          className="attach-button"
          aria-label="Anexar arquivo"
          title="Anexar fotos, vídeos, áudio ou documentos"
          disabled={voiceBusy}
          onClick={() => input.current?.click()}
        >
          <Paperclip size={22} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="expression-button"
          aria-label="Abrir emojis e figurinhas"
          title="Emojis e figurinhas"
          disabled={voiceBusy}
          onClick={() => setExpressions(true)}
        >
          <Smile size={22} />
        </button>
        <label htmlFor="message" className="sr-only">
          Mensagem
        </label>
        <textarea
          ref={messageInput}
          id="message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={4000}
          rows={1}
          placeholder="Mensagem…"
          className="message-input"
          hidden={voiceBusy}
          disabled={voiceBusy}
          onKeyDown={(e) => {
            if (
              settings.enterToSend &&
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <VoiceRecorder
          onBusyChange={setVoiceBusy}
          onError={(message) => {
            setError(message);
            setVoiceError(Boolean(message));
          }}
          onSend={(file) => {
            const result = validateAttachment(file);
            if (result.error !== undefined) {
              setError(result.error);
              return;
            }
            sendMessage(chatId, "", [
              {
                id: createDemoId(),
                name: file.name,
                size: file.size,
                kind: result.kind,
                url: fileUrl(file),
              },
            ]);
            setError("");
            setVoiceError(false);
          }}
        />
        <button
          type="submit"
          hidden={voiceBusy}
          className="send-button mb-0.5 shrink-0"
          disabled={!text.trim() && !attachments.length}
          aria-label="Enviar mensagem de teste"
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
