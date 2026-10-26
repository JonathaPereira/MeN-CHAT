"use client";

import {
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Check, Copy, Save, Trash2 } from "lucide-react";
import { useDemo } from "@/components/demo-provider";
import { Avatar } from "@/components/avatar";
import { ThemeToggle } from "@/components/theme-toggle";

const subscribeHydration = () => () => {};
export function ProfileForm() {
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
  return hydrated ? (
    <ProfileEditor />
  ) : (
    <main id="conteudo" className="p-8" aria-busy="true">
      Carregando perfil…
    </main>
  );
}

function ProfileEditor() {
  const { profile, saveProfile } = useDemo();
  const [name, setName] = useState(profile.name);
  const [status, setStatus] = useState(profile.status);
  const [photo, setPhoto] = useState(profile.photo);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function changePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setNotice("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      !file.size ||
      file.size > 2_000_000
    ) {
      setError("Escolha uma foto JPG, PNG ou WebP de até 2 MB.");
      return;
    }
    setLoadingPhoto(true);
    try {
      const bitmap = await createImageBitmap(file);
      const size = Math.min(256, bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas indisponível");
      const crop = Math.min(bitmap.width, bitmap.height);
      context.drawImage(
        bitmap,
        (bitmap.width - crop) / 2,
        (bitmap.height - crop) / 2,
        crop,
        crop,
        0,
        0,
        size,
        size,
      );
      bitmap.close();
      setPhoto(canvas.toDataURL("image/jpeg", 0.85));
    } catch {
      setError("Não foi possível ler esta imagem. Escolha outra foto.");
    } finally {
      setLoadingPhoto(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (name.trim().length < 2) {
      setError("O nome deve ter pelo menos 2 caracteres.");
      return;
    }
    if (
      !saveProfile({
        ...profile,
        name: name.trim(),
        status: status.trim(),
        photo,
      })
    ) {
      setError(
        "Não foi possível salvar. Verifique o armazenamento do navegador.",
      );
      return;
    }
    setNotice("Perfil salvo neste navegador.");
  }
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(profile.code);
      setNotice("Código copiado!");
    } catch {
      setNotice(`Seu código é ${profile.code}. Selecione o texto para copiar.`);
    }
  }
  return (
    <main
      id="conteudo"
      className="min-h-dvh bg-[var(--canvas)] px-5 py-6 sm:py-10"
    >
      <div className="mx-auto max-w-xl">
        <header className="mb-7 flex items-center justify-between">
          <Link
            href="/conversas"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--accent)]"
          >
            <ArrowLeft size={18} /> Voltar às conversas
          </Link>
          <ThemeToggle />
        </header>
        <section className="profile-card">
          <span className="eyebrow">DO SEU JEITO</span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Meu perfil
          </h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Uma foto, seu nome e um pouquinho sobre você.
          </p>
          <form onSubmit={submit} className="mt-8 space-y-6">
            <div className="flex flex-wrap items-center gap-5">
              <Avatar name={name || "Você"} photo={photo} large />
              <div>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  tabIndex={-1}
                  aria-label="Arquivo da foto de perfil"
                  onChange={changePhoto}
                />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => inputRef.current?.click()}
                  disabled={loadingPhoto}
                >
                  <Camera size={17} />
                  {loadingPhoto ? "Preparando…" : "Alterar foto"}
                </button>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  JPG, PNG ou WebP · até 2 MB
                </p>
                {photo && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoto("");
                      setNotice("");
                    }}
                    className="mt-2 inline-flex min-h-9 items-center gap-1 text-xs text-[var(--muted)]"
                  >
                    <Trash2 size={13} />
                    Remover foto
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="profile-name">
                Nome
              </label>
              <input
                id="profile-name"
                className="field"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNotice("");
                }}
                required
                minLength={2}
                maxLength={50}
                autoComplete="name"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="profile-status">
                Status personalizado
              </label>
              <textarea
                id="profile-status"
                className="field min-h-24 resize-y py-3"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setNotice("");
                }}
                maxLength={140}
                placeholder="O que você quer compartilhar hoje?"
              />
              <p className="mt-1 text-right text-xs text-[var(--muted)]">
                {status.length}/140
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-4">
              <p className="text-sm font-medium">Seu código de usuário</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <code className="select-all text-2xl font-semibold tracking-[0.2em] text-[var(--accent)]">
                  {profile.code}
                </code>
                <button
                  type="button"
                  onClick={copyCode}
                  className="icon-button"
                  aria-label="Copiar código de usuário"
                >
                  <Copy size={18} />
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                6 letras e números para encontrar um perfil. É um identificador
                de teste, não uma senha ou convite.
              </p>
            </div>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <p role="status" className="text-sm text-[var(--accent)]">
              {notice && (
                <span className="flex items-center gap-2">
                  <Check size={16} />
                  {notice}
                </span>
              )}
            </p>
            <button
              type="submit"
              disabled={loadingPhoto}
              className="primary-button w-full"
            >
              <Save size={17} />
              Salvar perfil
            </button>
          </form>
          <p className="demo-note mt-5">
            Nome, status, foto e código ficam salvos apenas neste navegador.
            Conversas e anexos são temporários. Nenhuma conta real é criada.
          </p>
        </section>
      </div>
    </main>
  );
}
