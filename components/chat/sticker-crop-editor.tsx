"use client";

import { useRef, type RefObject } from "react";
import {
  clampPosition,
  initialStickerCrop,
  type StickerCrop,
} from "@/lib/sticker-layout";

export function StickerCropEditor({
  canvas,
  value,
  onChange,
  disabled,
}: {
  canvas: RefObject<HTMLCanvasElement | null>;
  value: StickerCrop;
  onChange: (value: StickerCrop) => void;
  disabled: boolean;
}) {
  const drag = useRef<{
    pointer: number;
    clientX: number;
    clientY: number;
    x: number;
    y: number;
  } | null>(null);
  return (
    <>
      <canvas
        ref={canvas}
        width={512}
        height={512}
        className="sticker-canvas sticker-crop-canvas"
        aria-label="Prévia da figurinha"
        aria-describedby="sticker-crop-help"
        role="img"
        tabIndex={0}
        onPointerDown={(event) => {
          if (disabled) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            pointer: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY,
            x: value.x,
            y: value.y,
          };
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start || disabled || start.pointer !== event.pointerId) return;
          const rect = event.currentTarget.getBoundingClientRect();
          onChange({
            ...value,
            x: clampPosition(
              start.x +
                (((event.clientX - start.clientX) / rect.width) * 512) / 2.4,
            ),
            y: clampPosition(
              start.y +
                (((event.clientY - start.clientY) / rect.height) * 512) / 2.4,
            ),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          const delta = {
            ArrowLeft: [-5, 0],
            ArrowRight: [5, 0],
            ArrowUp: [0, -5],
            ArrowDown: [0, 5],
          }[event.key];
          if (!delta) return;
          event.preventDefault();
          onChange({
            ...value,
            x: clampPosition(value.x + delta[0]),
            y: clampPosition(value.y + delta[1]),
          });
        }}
      />
      <p
        id="sticker-crop-help"
        className="mb-4 text-xs leading-relaxed text-[var(--muted)]"
      >
        Arraste a imagem com o dedo ou mouse. Use os controles ou as setas do
        teclado para ajustar o recorte.
      </p>
      <fieldset className="sticker-crop-controls" disabled={disabled}>
        <legend className="field-label">Ajustar recorte</legend>
        <label>
          Zoom{" "}
          <span className="crop-zoom-value" aria-hidden="true">
            {value.zoom.toFixed(1)}×
          </span>
          <input
            type="range"
            aria-label="Zoom da figurinha"
            min={1}
            max={4}
            step={0.1}
            value={value.zoom}
            onChange={(e) =>
              onChange({ ...value, zoom: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Horizontal
          <input
            type="range"
            aria-label="Posição horizontal da figurinha"
            min={-100}
            max={100}
            step={1}
            value={value.x}
            onChange={(e) => onChange({ ...value, x: Number(e.target.value) })}
          />
        </label>
        <label>
          Vertical
          <input
            type="range"
            aria-label="Posição vertical da figurinha"
            min={-100}
            max={100}
            step={1}
            value={value.y}
            onChange={(e) => onChange({ ...value, y: Number(e.target.value) })}
          />
        </label>
        <label>
          Formato
          <select
            className="field mt-2"
            aria-label="Formato do recorte"
            value={value.shape}
            onChange={(e) =>
              onChange({
                ...value,
                shape: e.target.value as StickerCrop["shape"],
              })
            }
          >
            <option value="square">Quadrado</option>
            <option value="circle">Circular</option>
          </select>
        </label>
        <button
          type="button"
          className="secondary-button mt-3"
          onClick={() => onChange({ ...initialStickerCrop })}
        >
          Redefinir recorte
        </button>
      </fieldset>
    </>
  );
}
