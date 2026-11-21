const SPRITES = [
  "background",
  "avatar-p1",
  "avatar-p2",
  "cauldron-p1",
  "cauldron-p2",
  "wand-p1",
  "wand-p1-slash",
  "wand-p2",
  "wand-p2-slash",
  "moonberry",
  "moonberry-a",
  "moonberry-b",
  "mushroom",
  "mushroom-a",
  "mushroom-b",
  "fire-pepper",
  "fire-pepper-a",
  "fire-pepper-b",
  "star-fruit",
  "star-fruit-a",
  "star-fruit-b",
  "newt-eye",
  "newt-eye-a",
  "newt-eye-b",
  "dragon-scale",
  "dragon-scale-a",
  "dragon-scale-b",
  "carrot",
  "carrot-a",
  "carrot-b",
  "blue-crystal",
  "blue-crystal-a",
  "blue-crystal-b",
  "golden-bonus",
  "hazard-spiky",
  "hazard-spiky-warning",
  "hazard-spiky-hit",
  "hazard-vial",
  "hazard-slime",
  "hazard-skull",
] as const;

export type AssetName = (typeof SPRITES)[number];

export const IMG: Partial<Record<AssetName, HTMLImageElement>> = {};

/** Sprites are PNGs except the workshop backdrop, which is a vector export. */
const SOURCES: Partial<Record<AssetName, string>> = {
  background: "/assets/background.svg",
};

let loading: Promise<void> | null = null;

/** Load every sprite once; drawing simply skips ones that are not ready yet. */
export function preloadAssets(): Promise<void> {
  if (loading) return loading;
  loading = Promise.all(
    SPRITES.map(
      (name) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.decoding = "async";
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = SOURCES[name] ?? `/assets/${name}.png`;
          IMG[name] = img;
        }),
    ),
  ).then(() => undefined);
  return loading;
}

/**
 * Some exported symbols came with the frame's opaque backdrop baked in.
 * Flood-fill the border colour away so they sit on the workshop cleanly.
 */
const NEEDS_KEY = new Set([
  "cauldron-p1",
  "cauldron-p2",
  "wand-p1",
  "wand-p1-slash",
  "wand-p2",
  "wand-p2-slash",
  "hazard-spiky",
  "hazard-spiky-warning",
  "hazard-spiky-hit",
  "hazard-vial",
  "hazard-slime",
  "hazard-skull",
  "moonberry",
  "moonberry-a",
  "moonberry-b",
  "mushroom",
  "mushroom-a",
  "mushroom-b",
  "fire-pepper",
  "fire-pepper-a",
  "fire-pepper-b",
  "star-fruit",
  "star-fruit-a",
  "star-fruit-b",
  "newt-eye",
  "newt-eye-a",
  "newt-eye-b",
  "dragon-scale",
  "dragon-scale-a",
  "dragon-scale-b",
  "carrot",
  "carrot-a",
  "carrot-b",
  "blue-crystal",
  "blue-crystal-a",
  "blue-crystal-b",
  "golden-bonus",
]);

const keyed = new Map<string, HTMLCanvasElement>();

function keyedCanvas(name: string): HTMLCanvasElement | null {
  const cached = keyed.get(name);
  if (cached) return cached;
  const img = IMG[name as AssetName];
  if (!img || !img.complete || img.naturalWidth === 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);

  const W = canvas.width;
  const H = canvas.height;
  const data = ctx.getImageData(0, 0, W, H);
  const px = data.data;
  const r0 = px[0];
  const g0 = px[1];
  const b0 = px[2];
  const seen = new Uint8Array(W * H);
  const stack: number[] = [];

  for (let x = 0; x < W; x++) {
    stack.push(x, (H - 1) * W + x);
  }
  for (let y = 0; y < H; y++) {
    stack.push(y * W, y * W + W - 1);
  }

  while (stack.length) {
    const i = stack.pop() as number;
    if (seen[i]) continue;
    seen[i] = 1;
    const p = i * 4;
    const dist = Math.abs(px[p] - r0) + Math.abs(px[p + 1] - g0) + Math.abs(px[p + 2] - b0);
    if (dist > 26) continue;
    px[p + 3] = 0;
    const x = i % W;
    const y = (i - x) / W;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - W);
    if (y < H - 1) stack.push(i + W);
  }

  ctx.putImageData(data, 0, 0);
  keyed.set(name, canvas);
  return canvas;
}

const hazardKeyed = new Map<string, HTMLCanvasElement>();

/**
 * The hazard variant of a cauldron: same art, recoloured toxic green while the
 * fire and the cream highlights keep their own colour.
 */
export function hazardCauldron(name: "cauldron-p1" | "cauldron-p2"): CanvasImageSource | null {
  const cached = hazardKeyed.get(name);
  if (cached) return cached;
  const src = asset(name);
  if (!src) return null;

  const w = src instanceof HTMLImageElement ? src.naturalWidth : (src as HTMLCanvasElement).width;
  const h = src instanceof HTMLImageElement ? src.naturalHeight : (src as HTMLCanvasElement).height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0, w, h);

  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    // Warm pixels are the flames; leave them orange.
    if (r > g + 16 && g > b) continue;
    const [hue, sat, lum] = rgbToHsl(r, g, b);
    if (sat < 0.1) continue;
    void hue;
    const [nr, ng, nb] = hslToRgb(0.25, Math.min(1, sat * 1.15), lum);
    px[i] = nr;
    px[i + 1] = ng;
    px[i + 2] = nb;
  }
  ctx.putImageData(data, 0, 0);
  hazardKeyed.set(name, canvas);
  return canvas;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [Math.round(channel(h + 1 / 3) * 255), Math.round(channel(h) * 255), Math.round(channel(h - 1 / 3) * 255)];
}

export function asset(name: string): CanvasImageSource | null {
  if (NEEDS_KEY.has(name)) return keyedCanvas(name);
  const img = IMG[name as AssetName];
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}


