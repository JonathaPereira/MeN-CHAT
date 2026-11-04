"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Copy, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  normalizePhoto,
  reserveUpload,
  uploadFile,
  discardUpload,
} from "@/lib/chat/media";
import type { RealProfile, Upload } from "@/lib/chat/types";
import { RealAvatar } from "./avatar";
export function RealProfileForm({ profile }: { profile: RealProfile }) {
  const router = useRouter();
  const [client] = useState(() => createClient()),
    [name, setName] = useState(profile.display_name),
    [status, setStatus] = useState(profile.status_message),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [path, setPath] = useState(profile.avatar_path),
    [remove, setRemove] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [privacy, setPrivacy] = useState({
    show: profile.show_code,
    lookup: profile.allow_code_lookup,
    read: profile.read_receipts,
    typing: profile.show_typing,
  });
  const input = useRef<HTMLInputElement>(null),
    reservation = useRef<Upload | null>(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const frame = requestAnimationFrame(() => setPreview(url));
    return () => {
      cancelAnimationFrame(frame);
      URL.revokeObjectURL(url);
    };
  }, [file]);
  async function choose(file: File) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const normalized = await normalizePhoto(file);
      if (reservation.current) {
        void discardUpload(client, reservation.current).catch(() => {});
        reservation.current = null;
      }
      setPreview("");
      setFile(normalized);
      setRemove(false);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível preparar a foto.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const oldPath = path;
    try {
      if (file) {
        reservation.current ??= await reserveUpload(client, null, file);
        await uploadFile(client, reservation.current, file);
      }
      const result = await client.rpc("menchat_save_profile", {
        p_name: name.trim(),
        p_status: status.trim(),
        p_show_code: privacy.show,
        p_lookup: privacy.lookup,
        p_read: privacy.read,
        p_typing: privacy.typing,
        p_avatar: reservation.current?.id || null,
        p_remove: remove,
      });
      if (result.error)
        throw new Error(
          "Não foi possível salvar. Confira sua sessão, a migração 5 e o upload da foto.",
        );
      const savedPath = reservation.current?.path || (remove ? null : oldPath);
      setPath(savedPath);
      reservation.current = null;
      setFile(null);
      setPreview("");
      setRemove(false);
      setNotice("Perfil salvo na sua conta.");
      router.refresh();
      if (oldPath && oldPath !== savedPath) {
        const id = oldPath.split("/").at(-1);
        await client.storage.from("menchat-avatars").remove([oldPath]);
        if (id) await client.rpc("menchat_cancel_upload", { p_upload: id });
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Não foi possível salvar.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="mt-6 space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="real-profile-avatar">
          {preview && file ? (
            <Image
              unoptimized
              src={preview}
              alt="Prévia da foto de perfil"
              width={80}
              height={80}
              className="h-20 w-20 rounded-3xl object-cover"
            />
          ) : (
            <RealAvatar
              client={client}
              name={name}
              path={remove ? null : path}
            />
          )}
        </div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          ref={input}
          className="sr-only"
          aria-label="Escolher foto de perfil"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void choose(file);
          }}
        />
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Camera size={16} /> Foto
        </button>
        <button
          type="button"
          className="icon-button"
          disabled={busy}
          aria-label="Remover foto de perfil"
          onClick={() => {
            if (reservation.current) {
              void discardUpload(client, reservation.current).catch(() => {});
              reservation.current = null;
            }
            setFile(null);
            setPreview("");
            setRemove(true);
          }}
        >
          <Trash2 size={18} />
        </button>
      </div>
      <p className="text-xs text-[var(--muted)]">
        JPG, PNG ou WebP até 2 MB. A foto recebe recorte quadrado central e é
        reduzida para 256 × 256.
      </p>
      <div>
        <label htmlFor="account-name" className="field-label">
          Nome
        </label>
        <input
          id="account-name"
          className="field"
          required
          minLength={1}
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          autoComplete="name"
        />
      </div>
      <div>
        <label htmlFor="account-status" className="field-label">
          Seu status
        </label>
        <input
          id="account-status"
          className="field"
          maxLength={140}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={busy}
          placeholder="Como você está hoje?"
        />
      </div>
      <div className="rounded-xl border border-[var(--line)] p-4">
        <p className="text-xs text-[var(--muted)]">Seu código pessoal</p>
        <div className="flex items-center justify-between">
          <code className="text-lg tracking-widest">{profile.user_code}</code>
          <button
            type="button"
            className="icon-button"
            aria-label="Copiar meu código"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(profile.user_code);
                setNotice("Código copiado.");
              } catch {
                setNotice(`Seu código: ${profile.user_code}`);
              }
            }}
          >
            <Copy size={17} />
          </button>
        </div>
      </div>
      <fieldset disabled={busy} className="space-y-3">
        <legend className="mb-3 text-sm font-semibold">
          Privacidade da conta
        </legend>
        {(
          [
            ["show", "Mostrar meu código no perfil"],
            ["lookup", "Permitir que me encontrem pelo código"],
            ["read", "Compartilhar confirmações de leitura"],
            ["typing", "Mostrar quando estou digitando"],
          ] as const
        ).map(([key, label]) => (
          <label className="real-checkbox" key={key}>
            <input
              type="checkbox"
              checked={privacy[key]}
              onChange={(e) =>
                setPrivacy({ ...privacy, [key]: e.target.checked })
              }
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      {notice && (
        <p role="status" className="demo-note">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="primary-button w-full" disabled={busy}>
        {busy ? "Salvando…" : "Salvar perfil"}
      </button>
    </form>
  );
}
