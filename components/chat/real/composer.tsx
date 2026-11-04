"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { Paperclip, Send, Smile, X, FileText } from "lucide-react";
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
}: {
  disabled: boolean;
  busy: boolean;
  onSend: (text: string, file: File | null) => Promise<boolean>;
  onTyping: (value: boolean) => void;
  onError: (error: string) => void;
  onDiscard: () => void;
}) {
  const { settings } = usePreferences();
  const [text, setText] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [recording, setRecording] = useState(false),
    [emojis, setEmojis] = useState(false);
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
    if (await onSend(text.trim(), attachment)) {
      setText("");
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
              }}
              onKeyDown={(e) => {
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
