"use client";

import { useState } from "react";
import { Copy, LockKeyhole } from "lucide-react";
import { Avatar } from "@/components/avatar";

export function ProfilePreview({
  name,
  status,
  photo,
  color,
  code,
}: {
  name: string;
  status: string;
  photo?: string;
  color?: string;
  code: string | null;
}) {
  const [notice, setNotice] = useState("");
  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setNotice("Código copiado.");
    } catch {
      setNotice("Selecione o código para copiar.");
    }
  }
  return (
    <div className="profile-preview">
      <Avatar name={name} photo={photo} color={color} large />
      <h3 className="mt-5 text-xl font-semibold">{name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        {status || "Sem status"}
      </p>
      <div className="mt-6 w-full rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-4">
        {code ? (
          <>
            <p className="text-xs text-[var(--muted)]">Código do usuário</p>
            <div className="mt-2 flex items-center justify-center gap-3">
              <code className="select-all text-2xl font-semibold tracking-[.18em] text-[var(--accent)]">
                {code}
              </code>
              <button
                className="icon-button"
                aria-label={`Copiar código de ${name}`}
                onClick={copy}
              >
                <Copy size={17} />
              </button>
            </div>
          </>
        ) : (
          <p className="flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
            <LockKeyhole size={16} />
            Código oculto
          </p>
        )}
      </div>
      {notice && (
        <p role="status" className="mt-3 text-xs text-[var(--accent)]">
          {notice}
        </p>
      )}
    </div>
  );
}
