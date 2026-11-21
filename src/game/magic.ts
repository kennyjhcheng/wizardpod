/**
 * Wizard slice effects: the little explosion of magic that fires off when a
 * blade cuts an ingredient. Everything is drawn additively so it reads as
 * light rather than paint.
 */

const TAU = Math.PI * 2;

export type MagicKind = "lightning" | "runes" | "starburst" | "spiral";

/** Cycled per slice so consecutive cuts always look different. */
export const MAGIC_KINDS: readonly MagicKind[] = ["lightning", "runes", "starburst", "spiral"];

export interface MagicFx {
  kind: MagicKind;
  x: number;
  y: number;
  /** Unit vector along the direction of the slash. */
  ax: number;
  ay: number;
  color: string;
  life: number;
  max: number;
  seed: number;
}

const DURATION: Record<MagicKind, number> = {
  lightning: 0.42,
  runes: 0.6,
  starburst: 0.5,
  spiral: 0.66,
};

export function makeMagic(
  kind: MagicKind,
  x: number,
  y: number,
  ax: number,
  ay: number,
  color: string,
): MagicFx {
  return {
    kind,
    x,
    y,
    ax,
    ay,
    color,
    life: 0,
    max: DURATION[kind],
    seed: Math.floor(Math.random() * 100000),
  };
}

export function drawMagic(ctx: CanvasRenderingContext2D, fx: MagicFx): void {
  const t = Math.min(1, fx.life / fx.max);
  const fade = 1 - t;
  if (fade <= 0.002) return;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = fx.color;

  switch (fx.kind) {
    case "lightning":
      lightning(ctx, fx, t, fade);
      break;
    case "runes":
      runes(ctx, fx, t, fade);
      break;
    case "starburst":
      starburst(ctx, fx, t, fade);
      break;
    case "spiral":
      spiral(ctx, fx, t, fade);
      break;
  }

  ctx.restore();
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

function alpha(hex: string, a: number): string {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? [...raw].map((c) => c + c).join("") : raw;
  const n = parseInt(full, 16);
  const v = Math.max(0, Math.min(1, a));
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${v.toFixed(3)})`;
}

function rng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function trace(ctx: CanvasRenderingContext2D, pts: [number, number][]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

/** A jagged bolt along the slash, crackling and forking. */
function lightning(
  ctx: CanvasRenderingContext2D,
  fx: MagicFx,
  t: number,
  fade: number,
): void {
  const reach = 380;
  const fromX = fx.x - fx.ax * reach * 0.45;
  const fromY = fx.y - fx.ay * reach * 0.45;
  const toX = fx.x + fx.ax * reach * 0.55;
  const toY = fx.y + fx.ay * reach * 0.55;

  // Re-seed a few times a second so the bolt keeps its line but judders.
  const rand = rng(fx.seed + Math.floor(t * 45) * 7919);
  const steps = 8;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const wobble = (rand() - 0.5) * 56 * Math.sin(Math.PI * k);
    pts.push([
      fromX + (toX - fromX) * k - fx.ay * wobble,
      fromY + (toY - fromY) * k + fx.ax * wobble,
    ]);
  }

  // Halo.
  ctx.shadowBlur = 38;
  ctx.strokeStyle = alpha(fx.color, 0.32 * fade);
  ctx.lineWidth = 18;
  trace(ctx, pts);

  // Coloured bolt.
  ctx.shadowBlur = 20;
  ctx.strokeStyle = alpha(fx.color, 0.95 * fade);
  ctx.lineWidth = 6.5;
  trace(ctx, pts);

  // White-hot core.
  ctx.shadowBlur = 8;
  ctx.strokeStyle = alpha("#FFFFFF", 0.92 * fade);
  ctx.lineWidth = 2.4;
  trace(ctx, pts);

  // Forks.
  const baseAngle = Math.atan2(fx.ay, fx.ax);
  for (let b = 0; b < 3; b++) {
    const anchor = pts[2 + Math.floor(rand() * (steps - 2))];
    let angle = baseAngle + (rand() < 0.5 ? -1 : 1) * (0.55 + rand() * 0.8);
    let px = anchor[0];
    let py = anchor[1];
    const branch: [number, number][] = [[px, py]];
    for (let j = 0; j < 3; j++) {
      angle += (rand() - 0.5) * 0.7;
      const len = 22 + rand() * 26;
      px += Math.cos(angle) * len;
      py += Math.sin(angle) * len;
      branch.push([px, py]);
    }
    ctx.strokeStyle = alpha(fx.color, 0.8 * fade);
    ctx.lineWidth = 2.8;
    ctx.shadowBlur = 14;
    trace(ctx, branch);
  }
}

/** A ring of runes that blooms outward. */
function runes(ctx: CanvasRenderingContext2D, fx: MagicFx, t: number, fade: number): void {
  const r = 28 + easeOut(t) * 136;

  ctx.shadowBlur = 28;
  ctx.strokeStyle = alpha(fx.color, 0.9 * fade);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, r, 0, TAU);
  ctx.stroke();

  ctx.shadowBlur = 14;
  ctx.strokeStyle = alpha("#FFF3C4", 0.8 * fade);
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, r * 0.76, 0, TAU);
  ctx.stroke();

  // Little glyph ticks riding the outer ring.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + t * 1.9;
    const gx = fx.x + Math.cos(a) * r * 0.9;
    const gy = fx.y + Math.sin(a) * r * 0.9;
    const tx = -Math.sin(a);
    const ty = Math.cos(a);
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    ctx.strokeStyle = alpha(fx.color, 0.95 * fade);
    ctx.lineWidth = 4;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(gx + tx * 8, gy + ty * 8);
    ctx.lineTo(gx - tx * 8, gy - ty * 8);
    ctx.moveTo(gx - tx * 8, gy - ty * 8);
    ctx.lineTo(gx - tx * 8 + nx * 7, gy - ty * 8 + ny * 7);
    ctx.stroke();
  }
}

/** A flash of star rays punching out from the cut. */
function starburst(ctx: CanvasRenderingContext2D, fx: MagicFx, t: number, fade: number): void {
  const grow = easeOut(t);
  const spin = fx.seed * 0.001;

  ctx.shadowBlur = 26;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + spin;
    const long = i % 2 === 0;
    const inner = 16 + t * 26;
    const outer = (long ? 225 : 132) * (0.35 + grow);
    ctx.strokeStyle = alpha(fx.color, (long ? 0.9 : 0.55) * fade);
    ctx.lineWidth = long ? 6 : 3;
    ctx.beginPath();
    ctx.moveTo(fx.x + Math.cos(a) * inner, fx.y + Math.sin(a) * inner);
    ctx.lineTo(fx.x + Math.cos(a) * outer, fx.y + Math.sin(a) * outer);
    ctx.stroke();
  }

  ctx.shadowBlur = 32;
  ctx.fillStyle = alpha("#FFFFFF", fade * 0.95);
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, 5 + (1 - t) * 16, 0, TAU);
  ctx.fill();
}

/** A swirl of sparkles spiralling out of the cut. */
function spiral(ctx: CanvasRenderingContext2D, fx: MagicFx, t: number, fade: number): void {
  ctx.shadowBlur = 18;
  const count = 34;
  for (let i = 0; i < count; i++) {
    const k = i / count;
    const r = 10 + k * (70 + easeOut(t) * 130);
    const a = k * 4.4 + t * 5.2 + fx.seed * 0.001;
    const x = fx.x + Math.cos(a) * r;
    const y = fx.y + Math.sin(a) * r;
    ctx.fillStyle = alpha(i % 3 === 0 ? "#FFF3C4" : fx.color, (1 - k * 0.55) * fade);
    ctx.beginPath();
    ctx.arc(x, y, 4.6 * (1 - k * 0.5), 0, TAU);
    ctx.fill();
  }
}
