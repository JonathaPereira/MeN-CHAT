"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CheckCheck, ChevronRight, FlaskConical, Heart, LockKeyhole, MessageCircle, Search, Users, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { conversations } from "@/lib/data/conversations";
import type { Conversation } from "@/types/conversation";

const avatarColors: Record<Conversation["color"], string> = {
  sage: "bg-[#e4eedc] text-[#486634]",
  peach: "bg-[#f9e4d8] text-[#90543a]",
  lavender: "bg-[#eae5f6] text-[#68528e]",
  blue: "bg-[#e1edf5] text-[#3c6481]",
};

export function ConversationList() {
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const filtered = conversations.filter((item) =>
    item.name.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")) && (!unreadOnly || item.unread > 0),
  );

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="border-b border-slate-200/80 bg-white px-5 py-5 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <Link href="/login" aria-label="M&N CHAT, voltar ao login"><Brand /></Link>
          <div className="flex items-center gap-4 sm:gap-6">
            <span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><LockKeyhole size={14} aria-hidden="true" /> Só entre a gente</span>
            <Link href="/login" className="flex min-h-11 items-center gap-2 text-sm font-medium text-pine">Voltar ao login <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
      </header>
      <main id="conteudo" className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-9 lg:px-12">
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#dfdfbf] bg-[#f7f6e9] px-4 py-3 text-sm leading-relaxed text-[#686233]">
          <FlaskConical size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p><strong className="font-semibold">Um gostinho do que vem aí.</strong> Esta demonstração usa dados fictícios. Login, convites e envio de mensagens ainda não estão disponíveis.</p>
        </div>
        <div className="mb-7 flex items-end justify-between gap-4">
          <div><span className="eyebrow">SEU PONTO DE ENCONTRO</span><h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Conversas</h1><p className="mt-2 text-sm text-slate-500">As suas pessoas, a uma conversa de distância.</p></div>
          <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 sm:block">5 conversas ilustrativas</span>
        </div>
        <div className="grid flex-1 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_8px_40px_-20px_#15372f25] md:min-h-[580px] md:grid-cols-[minmax(300px,0.9fr)_1.1fr]">
          <section aria-label="Lista de conversas" className={`${selected ? "hidden md:block" : "block"} min-w-0 md:border-r md:border-slate-200`}>
            <div className="border-b border-slate-100 p-5">
              <label htmlFor="search" className="sr-only">Buscar conversas pelo nome</label>
              <div className="relative"><Search className="field-icon" size={18} aria-hidden="true" /><input id="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar uma conversa" className="field border-transparent bg-canvas pl-12" /></div>
              <div className="mt-4 flex gap-2" aria-label="Filtrar conversas">
                <button onClick={() => setUnreadOnly(false)} aria-pressed={!unreadOnly} className={`filter-chip ${!unreadOnly ? "bg-pine text-white" : "bg-canvas text-slate-600"}`}>Todas <span className="ml-1 opacity-80">5</span></button>
                <button onClick={() => setUnreadOnly(true)} aria-pressed={unreadOnly} className={`filter-chip ${unreadOnly ? "bg-pine text-white" : "bg-canvas text-slate-600"}`}>Não lidas <span className="ml-1 opacity-80">2</span></button>
              </div>
            </div>
            <ul className="p-2" aria-label="Resultados da busca">
              {filtered.map((conversation) => (
                <li key={conversation.id}>
                  <button onClick={() => setSelected(conversation)} aria-pressed={selected?.id === conversation.id} className={`group flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors sm:p-4 ${selected?.id === conversation.id ? "bg-[#edf4e9]" : "hover:bg-canvas"}`}>
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${avatarColors[conversation.color]}`}>{conversation.initials}</span>
                    <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-ink">{conversation.name}</span><span className="shrink-0 text-[11px] text-slate-500">{conversation.time}</span></span>
                      <span className="mt-2 flex items-center justify-between gap-3"><span className="truncate text-xs text-slate-500">{conversation.preview}</span>{conversation.unread > 0 ? <span aria-label={`${conversation.unread} mensagens não lidas fictícias`} className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-pine px-1 text-[10px] font-bold text-white">{conversation.unread}</span> : <CheckCheck size={15} aria-label="Leitura ilustrativa" className="shrink-0 text-slate-400" />}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {filtered.length === 0 && <p role="status" className="px-6 py-12 text-center text-sm text-slate-500">Nenhuma conversa encontrada. Tente outro nome ou filtro.</p>}
            <p className="px-6 pb-5 pt-3 text-xs text-slate-500" role="status">{filtered.length} {filtered.length === 1 ? "conversa encontrada" : "conversas encontradas"}</p>
          </section>
          <section aria-label={selected ? `Detalhes de ${selected.name}` : "Boas-vindas"} className={`${selected ? "flex" : "hidden md:flex"} relative min-w-0 flex-col items-center justify-center bg-[#fafcf9] px-6 py-14 text-center sm:px-10`}>
            {selected ? (
              <>
                <button onClick={() => setSelected(null)} className="absolute left-5 top-5 flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-pine"><ArrowLeft size={18} aria-hidden="true" /><span className="md:hidden">Voltar à lista</span><span className="hidden md:inline">Fechar detalhes</span></button>
                <span className={`mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] text-2xl font-semibold ${avatarColors[selected.color]}`}>{selected.initials}</span>
                <span className="eyebrow">{selected.kind === "group" ? "GRUPO ILUSTRATIVO" : "CONTATO ILUSTRATIVO"}</span>
                <h2 className="mt-3 text-2xl font-semibold text-ink">{selected.name}</h2>
                <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">{selected.description}</p>
                <div className="mt-8 max-w-sm rounded-2xl border border-dashed border-[#ccd8c6] bg-white p-5 text-sm leading-relaxed text-slate-500"><MessageCircle className="mx-auto mb-3 text-pine" size={24} aria-hidden="true" />As mensagens chegam em uma próxima etapa. Por enquanto, este espaço é só uma prévia.</div>
                <button onClick={() => setSelected(null)} className="secondary-button mt-6"><X size={16} aria-hidden="true" /> Fechar prévia</button>
              </>
            ) : (
              <>
                <div className="relative mb-8 flex h-32 w-32 items-center justify-center rounded-[2.5rem] bg-[#e9f1e3]"><MessageCircle size={55} strokeWidth={1.3} className="text-pine" aria-hidden="true" /><span className="absolute -bottom-2 -right-2 flex h-12 w-12 items-center justify-center rounded-2xl border-4 border-[#fafcf9] bg-[#f4e9d3]"><Heart size={20} className="text-[#94733c]" aria-hidden="true" /></span></div>
                <span className="eyebrow">FEITO PARA O NOSSO CÍRCULO</span>
                <h2 className="mt-3 max-w-xs text-3xl font-semibold leading-tight tracking-tight text-ink">Pequeno no tamanho.<br />Grande nas conexões.</h2>
                <p className="mt-5 max-w-xs text-sm leading-relaxed text-slate-500">Escolha uma conversa ao lado e explore a prévia do seu novo ponto de encontro.</p>
                <div className="mt-9 flex items-center gap-2 text-xs text-pine"><Users size={16} aria-hidden="true" /> Amigos e família. Só quem faz parte.<ChevronRight size={14} aria-hidden="true" /></div>
              </>
            )}
          </section>
        </div>
        <footer className="mt-6 text-center text-xs text-slate-500">M&N CHAT · Feito para estar perto.</footer>
      </main>
    </div>
  );
}
