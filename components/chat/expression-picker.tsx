"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { Plus, RotateCw, Trash2, Upload, Snowflake } from "lucide-react";
import { StickerCropEditor } from "./sticker-crop-editor";
import { initialStickerCrop } from "@/lib/sticker-layout";
import { Modal } from "@/components/modal";
import { emojiCategories, searchEmojis } from "@/lib/emojis";
import {
  drawSticker,
  encodeSticker,
  readStickerImage,
  stickerStore,
  STICKER_LIMIT,
  type Sticker,
} from "@/lib/stickers";

export function ExpressionPicker({
  onClose,
  onEmoji,
  onSticker,
  onSnowball,
  snowballUsed,
}: {
  onClose: () => void;
  onSnowball: () => void;
  snowballUsed: boolean;
  onEmoji: (emoji: string) => void;
  onSticker: (sticker: Sticker) => void;
}) {
  const [tab, setTab] = useState("Emojis");
  const [category, setCategory] = useState(0);
  const [query, setQuery] = useState("");
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [name, setName] = useState("Minha figurinha");
  const [text, setText] = useState("");
  const [rotate, setRotate] = useState(0);
  const [crop, setCrop] = useState(false);
  const [adjustments, setAdjustments] = useState({ ...initialStickerCrop });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const createInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const working = useRef(false);
  useEffect(() => {
    alive.current = true;
    stickerStore("list")
      .then((items) => {
        if (alive.current) {
          setStickers(items);
          setLoaded(true);
        }
      })
      .catch((error: Error) => {
        if (alive.current) setError(error.message);
      });
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (image && canvas.current)
      drawSticker(canvas.current, image, { rotate, crop, text, adjustments });
  }, [image, rotate, crop, text, tab, adjustments]);
  function begin() {
    if (working.current) return false;
    working.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    return true;
  }
  function finish() {
    working.current = false;
    if (alive.current) setBusy(false);
  }
  async function choose(
    event: ChangeEvent<HTMLInputElement>,
    importing: boolean,
  ) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || !begin()) return;
    try {
      if (importing && files.length + stickers.length > STICKER_LIMIT)
        throw new Error(
          "A coleção comporta até 40 figurinhas. Importe menos imagens ou exclua algumas.",
        );
      let added = 0;
      const failures: string[] = [];
      for (const file of files) {
        if (!alive.current) break;
        try {
          const source = await readStickerImage(file);
          if (!alive.current) break;
          if (!importing) {
            setImage(source);
            setName(file.name.replace(/\.[^.]+$/, "").slice(0, 40));
            setText("");
            setRotate(0);
            setCrop(false);
            setAdjustments({ ...initialStickerCrop });
            break;
          }
          const target = document.createElement("canvas");
          drawSticker(target, source, { rotate: 0, crop: false, text: "" });
          const sticker = await encodeSticker(
            target,
            file.name.replace(/\.[^.]+$/, ""),
          );
          if (!alive.current) break;
          const items = await stickerStore("save", sticker);
          if (alive.current) setStickers(items);
          added++;
        } catch (error) {
          failures.push(
            `${file.name}: ${error instanceof Error ? error.message : "Falha ao importar."}`,
          );
        }
      }
      if (alive.current) {
        setError(failures.join(" "));
        if (added)
          setNotice(`${added} figurinha(s) importada(s). Toque para enviar.`);
      }
    } catch (error) {
      if (alive.current) setError((error as Error).message);
    } finally {
      finish();
    }
  }
  async function save() {
    if (!canvas.current || !begin()) return;
    try {
      const sticker = await encodeSticker(canvas.current, name);
      if (!alive.current) return;
      const items = await stickerStore("save", sticker);
      if (alive.current) {
        setStickers(items);
        setImage(null);
        setNotice("Figurinha criada. Toque nela para enviar.");
      }
    } catch (error) {
      if (alive.current) setError((error as Error).message);
    } finally {
      finish();
    }
  }
  async function remove(id: string) {
    if (!begin()) return;
    try {
      const items = await stickerStore("delete", id);
      if (alive.current) {
        setStickers(items);
        setNotice("Figurinha excluída da coleção.");
      }
    } catch (error) {
      if (alive.current) setError((error as Error).message);
    } finally {
      finish();
    }
  }
  const emojis = query.trim()
    ? searchEmojis(query)
    : emojiCategories[category].items;
  return (
    <Modal title="Emojis e figurinhas" onClose={onClose}>
      <div
        className="expression-tabs"
        role="group"
        aria-label="Tipo de expressão"
      >
        {["Emojis", "Figurinhas"].map((item) => (
          <button
            key={item}
            type="button"
            className="filter-pill"
            aria-pressed={tab === item}
            onClick={() => setTab(item)}
            disabled={busy}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === "Emojis" ? (
        <>
          <label className="field-label" htmlFor="emoji-search">
            Buscar emoji
          </label>
          <input
            id="emoji-search"
            className="field"
            placeholder="Coração, sorriso, café…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div
            className="expression-tabs mt-3"
            role="group"
            aria-label="Categorias de emojis"
          >
            {emojiCategories.map((item, index) => (
              <button
                key={item.name}
                type="button"
                className="filter-pill"
                aria-pressed={!query && category === index}
                onClick={() => {
                  setCategory(index);
                  setQuery("");
                }}
              >
                {item.name}
              </button>
            ))}
          </div>
          <div className="emoji-grid" aria-label="Emojis disponíveis">
            {emojis.map(([emoji, label]) => (
              <button
                type="button"
                key={emoji}
                className="emoji-choice"
                aria-label={label}
                title={label}
                onClick={() => onEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
          {!emojis.length && (
            <p role="status" className="demo-note">
              Nenhum emoji encontrado.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="demo-note mb-4">
            Figurinhas estáticas WebP, 512 × 512 e até 100 KB, com transparência
            quando presente na imagem. Salvas só neste navegador (
            {stickers.length}/{STICKER_LIMIT}).
          </p>
          <input
            ref={createInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-label="Imagem para criar figurinha"
            onChange={(e) => void choose(e, false)}
            disabled={busy || !loaded}
          />
          <input
            ref={importInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-label="Importar imagens como figurinhas"
            onChange={(e) => void choose(e, true)}
            disabled={busy || !loaded}
          />
          {image ? (
            <div className="sticker-editor">
              <StickerCropEditor
                canvas={canvas}
                value={adjustments}
                onChange={setAdjustments}
                disabled={busy}
              />
              <label className="field-label" htmlFor="sticker-name">
                Nome da figurinha
              </label>
              <input
                id="sticker-name"
                className="field"
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
              />
              <label className="field-label mt-3" htmlFor="sticker-text">
                Texto na figurinha (opcional)
              </label>
              <input
                id="sticker-text"
                className="field"
                value={text}
                maxLength={40}
                onChange={(e) => setText(e.target.value)}
                disabled={busy}
              />
              <div className="expression-tabs mt-3">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setRotate((n) => (n + 1) % 4)}
                  disabled={busy}
                >
                  <RotateCw size={16} /> Girar
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  aria-pressed={crop}
                  onClick={() => setCrop(!crop)}
                  disabled={busy}
                >
                  {crop ? "Mostrar imagem inteira" : "Recortar ao centro"}
                </button>
              </div>
              <div className="expression-tabs mt-3">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setImage(null)}
                  disabled={busy}
                >
                  Cancelar edição
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void save()}
                  disabled={busy}
                >
                  Salvar figurinha
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="expression-tabs">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy || !loaded || stickers.length >= STICKER_LIMIT}
                  onClick={() => createInput.current?.click()}
                >
                  <Plus size={16} /> Criar figurinha
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy || !loaded || stickers.length >= STICKER_LIMIT}
                  onClick={() => importInput.current?.click()}
                >
                  <Upload size={16} /> Importar
                </button>
              </div>
              {!stickers.length && loaded && (
                <p className="my-5 text-sm text-[var(--muted)]">
                  Sua coleção está vazia. Crie ou importe uma figurinha para
                  começar.
                </p>
              )}
              <ul
                className="sticker-grid"
                aria-label="Minha coleção de figurinhas"
              >
                {stickers.map((sticker) => (
                  <li key={sticker.id} className="sticker-tile">
                    <button
                      type="button"
                      className="sticker-send"
                      aria-label={`Enviar figurinha ${sticker.name}`}
                      disabled={busy}
                      onClick={() => onSticker(sticker)}
                    >
                      <Image
                        src={sticker.dataUrl}
                        alt={sticker.name}
                        width={100}
                        height={100}
                        unoptimized
                      />
                      <span className="block truncate text-xs">
                        {sticker.name}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="sticker-delete"
                      aria-label={`Excluir figurinha ${sticker.name}`}
                      onClick={() => void remove(sticker.id)}
                      disabled={busy}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
                Importe arquivos PNG, JPG ou WebP de até 5 MB cada. Animações
                viram imagens estáticas. Não importa pacotes ou links do
                WhatsApp e não remove o fundo automaticamente. Toque em uma
                figurinha para enviá-la imediatamente.
              </p>
            </>
          )}
        </>
      )}
      {!image && (
        <section className="snowball-option">
          <button
            type="button"
            className="secondary-button"
            onClick={onSnowball}
            disabled={busy || snowballUsed}
          >
            <Snowflake size={18} />
            {snowballUsed ? "Bola de neve já usada" : "Jogar bola de neve"}
          </button>
          <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
            Uma vez por pessoa nesta conversa. No teste, o aviso e a vibração
            são simulados neste aparelho; o limite reinicia ao recarregar a aba.
          </p>
        </section>
      )}
      {busy && (
        <p role="status" className="demo-note mt-4">
          Preparando figurinhas…
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-sm text-[var(--accent)]">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error mt-4">
          {error}
        </p>
      )}
    </Modal>
  );
}
