export type StickerCrop = {
  zoom: number;
  x: number;
  y: number;
  shape: "square" | "circle";
};
export const initialStickerCrop: StickerCrop = {
  zoom: 1,
  x: 0,
  y: 0,
  shape: "square",
};
export function clampPosition(value: number) {
  return Math.max(-100, Math.min(100, value));
}
export function stickerLayout(
  width: number,
  height: number,
  rotate: number,
  fill: boolean,
  adjustments: StickerCrop = initialStickerCrop,
) {
  const swapped = Math.abs(rotate % 2) === 1;
  const w = swapped ? height : width;
  const h = swapped ? width : height;
  const base = fill ? Math.max(480 / w, 480 / h) : Math.min(480 / w, 480 / h);
  return {
    scale: base * Math.max(1, Math.min(4, adjustments.zoom)),
    centerX: 256 + clampPosition(adjustments.x) * 2.4,
    centerY: 256 + clampPosition(adjustments.y) * 2.4,
  };
}
