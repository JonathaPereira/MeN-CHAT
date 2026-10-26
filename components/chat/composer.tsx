"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { File, Paperclip, Send, Mic, X } from "lucide-react";
import {
  attachmentAccept,
  MAX_ATTACHMENTS,
  validateAttachment,
  formatFileSize,
} from "@/lib/attachments";
import { VoiceRecorder } from "./voice-recorder";
import { usePreferences } from "@/components/preferences-provider";
import { useDemo } from "@/components/demo-provider";
import { createDemoId } from "@/lib/demo-id";
import type { Attachment } from "@/types/chat";

export function Composer({ chatId }: { chatId: string }) {
  const { settings } = usePreferences();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const audioInput = useRef<HTMLInputElement>(null);
  const { sendMessage, fileUrl, releaseUrl } = useDemo();
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const pendingRef = useRef<Attachment[]>([]);
  const [error, setError] = useState("");
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
    if (!text.trim() && !attachments.length) return;
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
      {voiceOpen && (
        <VoiceRecorder
          onAttach={(file) => addFiles([file])}
          onClose={() => setVoiceOpen(false)}
          onChooseFile={() => audioInput.current?.click()}
        />
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
          setVoiceOpen(false);
        }}
      />
      <form onSubmit={submit} className="flex items-end gap-2">
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
          className="icon-button mb-1 shrink-0"
          aria-label="Anexar arquivo"
          onClick={() => input.current?.click()}
        >
          <Paperclip size={22} />
        </button>
        <label htmlFor="message" className="sr-only">
          Mensagem
        </label>
        <textarea
          id="message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={4000}
          rows={1}
          placeholder="Escreva uma mensagem…"
          className="message-input"
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
        <button
          type="button"
          className="icon-button mb-1 shrink-0"
          aria-label="Gravar mensagem de voz"
          onClick={() => setVoiceOpen(true)}
          disabled={voiceOpen}
        >
          <Mic size={21} />
        </button>
        <button
          type="submit"
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
