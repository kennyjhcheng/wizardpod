import { Blade, segmentHitsCircle, type Segment } from "./blade";
import { asset, hazardCauldron, preloadAssets } from "./assets";
import { Cauldron } from "./cauldron";
import { byId, INGREDIENTS } from "./ingredients";
import { DESIGN_H, DESIGN_W, paintScene } from "./scene";
import { drawMagic, MAGIC_KINDS, makeMagic, type MagicFx } from "./magic";
import { hazardSound, magicSound } from "./sound";
import type { Sample } from "../input/types";

export type Side = 0 | 1;

export const ROUND_SECONDS = 90;
export const TARGET_SCORE = 5000;
const TAU = Math.PI * 2;
const GRAVITY = 1500;
const MIN_CUT_SPEED = 170;

const RECIPE_POINTS = 100;
const DECOY_POINTS = -300;
const HAZARD_POINTS = -500;
const BONUS_POINTS = 250;
const BREW_BONUS = 500;

const PLAY_MIN_X = 34;
const PLAY_MAX_X = 1886;
const MID_X = 960;
const SPAWN_Y = 930;
const DEAD_Y = 1080;

const CAULDRON: [number, number] = [400, 590];
const CAULDRON_SIZE: [number, number] = [358, 336];
const CAULDRON_RIGHT: [number, number] = [1150, 590];

export interface Recipe {
  name: string;
  items: [string, string, string];
  decoy: string;
}

const RECIPES: Recipe[] = [
  { name: "Moonlight tonic", items: ["moonberry", "newt-eye", "blue-crystal"], decoy: "carrot" },
  { name: "Dragonfire elixir", items: ["fire-pepper", "mushroom", "dragon-scale"], decoy: "star-fruit" },
  { name: "Harvest brew", items: ["carrot", "mushroom", "moonberry"], decoy: "newt-eye" },
  { name: "Crystal fizz", items: ["blue-crystal", "star-fruit", "dragon-scale"], decoy: "fire-pepper" },
  { name: "Starry stew", items: ["star-fruit", "carrot", "newt-eye"], decoy: "blue-crystal" },
  { name: "Pepper punch", items: ["fire-pepper", "carrot", "star-fruit"], decoy: "mushroom" },
];

interface Item {
  kindId: string | null;
  hazard: boolean;
  side: Side;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  r: number;
  dead: boolean;
}

interface Half {
  kindId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  r: number;
  which: 0 | 1;
  life: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  life: number;
  max: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  max: number;
}

interface Player {
  score: number;
  collected: Set<string>;
  recipe: number;
  combo: number;
  comboAt: number;
  cursor: { x: number; y: number };
  present: boolean;
  blade: Blade;
  spawnIn: number;
  slashUntil: number;
}

export interface SideView {
  score: number;
  collected: boolean[];
  recipeName: string;
  recipeItems: string[];
  pool: string[];
}

export interface Snapshot {
  left: SideView;
  right: SideView;
  seconds: number;
  running: boolean;
}

export interface RunResult {
  scores: [number, number];
  winner: 0 | 1 | 2;
}

const TINT = ["#a9c8ff", "#ffc98a"] as const;
const MAGIC_TINT = ["#8ED8FF", "#FFB86B"] as const;
const HAZARD_TINT = "#9BFF3C";

export class Game {
  onEnd: ((r: RunResult) => void) | null = null;

  private ctx: CanvasRenderingContext2D;
  private bg = document.createElement("canvas");
  private cssW = 1;
  private cssH = 1;
  private scale = 1;
  private ox = 0;
  private oy = 0;

  private items: Item[] = [];
  private halves: Half[] = [];
  private bits: Particle[] = [];
  private texts: FloatText[] = [];
  private magic: MagicFx[] = [];
  private magicTurn = 0;
  private players: [Player, Player];
  private cauldrons: [Cauldron, Cauldron];
  private running = false;
  private elapsed = 0;
  private shake = 0;
  private acid = 0;
  private last = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot draw a 2D canvas");
    this.ctx = ctx;
    paintScene(this.bg);
    this.players = [this.newPlayer(0), this.newPlayer(1)];
    this.cauldrons = [
      new Cauldron(0, CAULDRON[0], CAULDRON[1], CAULDRON_SIZE[0], CAULDRON_SIZE[1]),
      new Cauldron(1, CAULDRON_RIGHT[0], CAULDRON_RIGHT[1], CAULDRON_SIZE[0], CAULDRON_SIZE[1]),
    ];
    void preloadAssets().then(() => this.paintBackdrop());
    this.resize();
    requestAnimationFrame(this.frame);
  }

  /** Swap the procedural fallback for the Figma workshop art once it loads. */
  private paintBackdrop(): void {
    const img = asset("background");
    const ctx = this.bg.getContext("2d");
    if (!img || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, DESIGN_W, DESIGN_H);
    ctx.drawImage(img, 0, 0, DESIGN_W, DESIGN_H);
  }

  private newPlayer(recipe: number): Player {
    return {
      score: 0,
      collected: new Set(),
      recipe,
      combo: 0,
      comboAt: 0,
      cursor: { x: recipe === 0 ? 480 : 1440, y: 620 },
      present: true,
      blade: new Blade(),
      spawnIn: 0.4,
      slashUntil: 0,
    };
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(320, rect.width || window.innerWidth);
    const h = Math.max(320, rect.height || window.innerHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cssW = w;
    this.cssH = h;
    this.scale = Math.min(w / DESIGN_W, h / DESIGN_H);
    this.ox = (w - DESIGN_W * this.scale) / 2;
    this.oy = (h - DESIGN_H * this.scale) / 2;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  start(): void {
    const rightPresent = this.players[1].present;
    this.players = [this.newPlayer(0), this.newPlayer(1)];
    this.players[1].present = rightPresent;
    this.cauldrons[0].reset();
    this.cauldrons[1].reset();
    this.items = [];
    this.halves = [];
    this.bits = [];
    this.texts = [];
    this.magic = [];
    this.elapsed = 0;
    this.shake = 0;
    this.acid = 0;
    this.running = true;
    this.last = performance.now();
  }

  stop(): void {
    this.running = false;
    this.items = [];
    this.halves = [];
    this.bits = [];
    this.texts = [];
    this.magic = [];
    this.players[0].blade.clear();
    this.players[1].blade.clear();
  }

  setPresent(side: Side, present: boolean): void {
    this.players[side].present = present;
  }

  /** Live items in play. Read-only; the scripted `?demo` harness aims with it. */
  liveItems(): Array<{ side: Side; kindId: string | null; hazard: boolean; x: number; y: number; r: number }> {
    return this.items.map(({ side, kindId, hazard, x, y, r }) => ({ side, kindId, hazard, x, y, r }));
  }

  snapshot(): Snapshot {
    return {
      left: this.sideView(0),
      right: this.sideView(1),
      seconds: Math.max(0, Math.ceil(ROUND_SECONDS - this.elapsed)),
      running: this.running,
    };
  }

  private sideView(side: Side): SideView {
    const p = this.players[side];
    const recipe = RECIPES[p.recipe];
    return {
      score: p.score,
      collected: recipe.items.map((id) => p.collected.has(id)),
      recipeName: recipe.name,
      recipeItems: [...recipe.items],
      pool: [...recipe.items, recipe.decoy],
    };
  }

  /** Normalised screen position from one of the two inputs. */
  input(side: Side, sample: Sample): void {
    const x = sample.x * this.cssW;
    const y = sample.y * this.cssH;
    this.inputDesign(side, (x - this.ox) / this.scale, (y - this.oy) / this.scale, sample.active);
  }

  /** Blade position straight in stage coordinates (used by the `?demo` harness). */
  inputDesign(side: Side, designX: number, designY: number, active = true): void {
    const p = this.players[side];
    const min = side === 0 ? PLAY_MIN_X : MID_X + 12;
    const max = side === 0 ? MID_X - 12 : PLAY_MAX_X;
    const vx = Math.max(min, Math.min(max, designX));
    const vy = Math.max(120, Math.min(DESIGN_H - 40, designY));
    p.cursor.x = vx;
    p.cursor.y = vy;

    if (!this.running) {
      p.blade.clear();
      return;
    }
    const seg = p.blade.add(vx, vy, active);
    if (seg && seg.speed >= MIN_CUT_SPEED) {
      this.cut(side, seg);
      p.slashUntil = performance.now() + 160;
    }
  }

  private frame = (now: number) => {
    requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, Math.max(0.001, (now - (this.last || now)) / 1000));
    this.last = now;
    this.update(dt);
    this.draw(now);
  };

  private update(dt: number): void {
    const rect = this.canvas.getBoundingClientRect();
    if (Math.abs(rect.width - this.cssW) > 0.5 || Math.abs(rect.height - this.cssH) > 0.5) this.resize();

    if (this.running) {
      this.elapsed += dt;
      const [a, b] = [this.players[0].score, this.players[1].score];
      if (this.elapsed >= ROUND_SECONDS || a >= TARGET_SCORE || b >= TARGET_SCORE) this.finish();
      this.spawnTick(0, dt);
      this.spawnTick(1, dt);
    }

    for (const it of this.items) {
      it.vy += GRAVITY * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.rot += it.spin * dt;
      if (!it.dead && it.y - it.r > DEAD_Y) it.dead = true;
    }
    this.items = this.items.filter((i) => !i.dead);

    for (const h of this.halves) {
      h.vy += GRAVITY * dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.rot += h.spin * dt;
      h.life += dt;
    }
    this.halves = this.halves.filter((h) => h.life < 1.8 && h.y - h.r < DEAD_Y + 240);

    for (const p of this.bits) {
      p.vy += GRAVITY * 0.7 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life += dt;
    }
    this.bits = this.bits.filter((p) => p.life < p.max);

    for (const t of this.texts) {
      t.y -= 56 * dt;
      t.life += dt;
    }
    this.texts = this.texts.filter((t) => t.life < t.max);

    for (const fx of this.magic) fx.life += dt;
    this.magic = this.magic.filter((fx) => fx.life < fx.max);

    this.shake = this.shake > 0.2 ? this.shake * 0.9 : 0;
    this.acid = this.acid > 0.01 ? this.acid * 0.9 : 0;

    const now = performance.now();
    this.cauldrons[0].update(dt, now);
    this.cauldrons[1].update(dt, now);
  }

  private finish(): void {
    if (!this.running) return;
    this.running = false;
    const a = this.players[0].score;
    const b = this.players[1].score;
    this.onEnd?.({ scores: [a, b], winner: a === b ? 0 : a > b ? 1 : 2 });
  }

  private spawnTick(side: Side, dt: number): void {
    const p = this.players[side];
    p.spawnIn -= dt;
    if (p.spawnIn > 0) return;
    p.spawnIn = Math.max(0.62, 1.15 - this.elapsed * 0.005) * (0.85 + Math.random() * 0.3);

    const count = 1 + (Math.random() < 0.4 ? 1 : 0);
    for (let i = 0; i < count; i++) this.launch(side, i, count);
  }

  private launch(side: Side, index: number, count: number): void {
    const recipe = RECIPES[this.players[side].recipe];
    const roll = Math.random();
    const hazard = this.elapsed > 7 && roll < 0.15;
    const bonus = !hazard && roll > 0.96;
    const remaining = recipe.items.filter((id) => !this.players[side].collected.has(id));

    const kindId = hazard
      ? null
      : bonus
        ? "golden-bonus"
        : Math.random() < 0.66 && remaining.length > 0
          ? remaining[Math.floor(Math.random() * remaining.length)]
          : [...recipe.items, recipe.decoy][Math.floor(Math.random() * 4)];

    const laneSpan = side === 0 ? [PLAY_MIN_X + 90, MID_X - 110] : [MID_X + 110, PLAY_MAX_X - 90];
    const lane = count === 1 ? 0.5 : (index + 0.5) / count;
    const x = laneSpan[0] + (laneSpan[1] - laneSpan[0]) * (0.18 + lane * 0.64);
    const r = (kindId ? byId(kindId).r : 0.058) * DESIGN_H;
    const apex = 380 + Math.random() * 130;
    const vy = -Math.sqrt(2 * GRAVITY * Math.max(420, SPAWN_Y - apex));
    const tApex = -vy / GRAVITY;
    const targetX = laneSpan[0] + Math.random() * (laneSpan[1] - laneSpan[0]);
    const vx = Math.max(-160, Math.min(160, (targetX - x) / Math.max(0.25, tApex)));

    this.items.push({
      kindId,
      hazard,
      side,
      x,
      y: SPAWN_Y + r,
      vx,
      vy,
      rot: (Math.random() - 0.5) * 0.6,
      spin: (Math.random() - 0.5) * 2.4,
      r,
      dead: false,
    });
  }

  private cut(side: Side, seg: Segment): void {
    for (const it of this.items) {
      if (it.dead || it.side !== side) continue;
      const hitRadius = it.hazard ? it.r * 1.15 : it.r;
      if (!segmentHitsCircle(seg.from, seg.to, it.x, it.y, hitRadius)) continue;
      it.dead = true;
      if (it.hazard) this.hitHazard(it, seg);
      else if (it.kindId) this.hitIngredient(it, it.kindId, seg);
    }
  }

  private hitIngredient(it: Item, kindId: string, seg: Segment): void {
    const p = this.players[it.side];
    const recipe = RECIPES[p.recipe];
    const now = performance.now();
    const golden = kindId === "golden-bonus";
    const wanted = recipe.items.includes(kindId);

    if (wanted || golden) {
      p.combo = now - p.comboAt < 700 ? Math.min(4, p.combo + 1) : 1;
      p.comboAt = now;
      const points = golden ? BONUS_POINTS : RECIPE_POINTS * p.combo;
      p.score += points;
      if (wanted) p.collected.add(kindId);
      this.texts.push({
        x: it.x,
        y: it.y - it.r * 0.5,
        text: `+${points}`,
        color: golden ? "#FFD54A" : "#FFF3C4",
        size: golden ? 44 : 34,
        life: 0,
        max: 0.9,
      });

      if (recipe.items.every((id) => p.collected.has(id))) {
        p.score += BREW_BONUS;
        p.collected.clear();
        p.recipe = this.nextRecipe(it.side);
        this.texts.push({
          x: 480 + it.side * 960,
          y: 780,
          text: "POTION BREWED!",
          color: "#FFD54A",
          size: 44,
          life: 0,
          max: 1.4,
        });
        this.puff(it.x, it.y, "#FFD54A", 22);
        this.cauldrons[it.side].brew(performance.now());
      }
    } else {
      p.combo = 0;
      p.score = Math.max(0, p.score + DECOY_POINTS);
      this.shake = Math.max(this.shake, 10);
      this.texts.push({
        x: it.x,
        y: it.y - it.r * 0.5,
        text: `${DECOY_POINTS}`,
        color: "#FF9B8A",
        size: 34,
        life: 0,
        max: 0.9,
      });
    }

    this.slice(it, kindId);
    this.magicAt(it.x, it.y, it.side, seg, golden ? "#FFD54A" : MAGIC_TINT[it.side]);
  }

  /** Next recipe for a side: never the one it just finished, nor the opponent's. */
  private nextRecipe(side: Side): number {
    const other = this.players[side === 0 ? 1 : 0].recipe;
    const options = RECIPES.map((_, i) => i).filter(
      (i) => i !== this.players[side].recipe && i !== other,
    );
    return options[Math.floor(Math.random() * options.length)] ?? (this.players[side].recipe + 1) % RECIPES.length;
  }

  private hitHazard(it: Item, seg: Segment): void {
    const p = this.players[it.side];
    p.score = Math.max(0, p.score + HAZARD_POINTS);
    p.combo = 0;
    this.shake = Math.max(this.shake, 26);
    this.acid = 0.5;
    this.texts.push({
      x: it.x,
      y: it.y - it.r,
      text: `${HAZARD_POINTS}`,
      color: "#9BFF3C",
      size: 42,
      life: 0,
      max: 1,
    });
    this.puff(it.x, it.y, HAZARD_TINT, 18);
    this.cauldrons[it.side].hitHazard(performance.now());
    this.magicAt(it.x, it.y, it.side, seg, HAZARD_TINT, false);
    hazardSound(it.side);
  }

  private slice(it: Item, kindId: string): void {
    const nx = Math.cos(it.rot + Math.PI / 2);
    const ny = Math.sin(it.rot + Math.PI / 2);
    for (const which of [0, 1] as const) {
      const dir = which === 0 ? 1 : -1;
      this.halves.push({
        kindId,
        x: it.x + nx * dir * it.r * 0.2,
        y: it.y + ny * dir * it.r * 0.2,
        vx: it.vx * 0.5 + nx * dir * 210,
        vy: it.vy * 0.5 + ny * dir * 210,
        rot: it.rot,
        spin: dir * 2.4,
        r: it.r,
        which,
        life: 0,
      });
    }
    const kind = INGREDIENTS.find((k) => k.id === kindId);
    this.puff(it.x, it.y, kind?.juice ?? "#FFD54A", 12);
  }

  /** Fire the next wizard effect, aimed along the slash. */
  private magicAt(x: number, y: number, side: Side, seg: Segment, color: string, sound = true): void {
    const kind = MAGIC_KINDS[this.magicTurn++ % MAGIC_KINDS.length];
    const dx = seg.to.x - seg.from.x;
    const dy = seg.to.y - seg.from.y;
    const len = Math.hypot(dx, dy) || 1;
    this.magic.push(makeMagic(kind, x, y, dx / len, dy / len, color));
    if (this.magic.length > 24) this.magic.shift();
    if (sound) magicSound(kind, side);
  }

  private puff(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const s = 80 + Math.random() * 320;
      this.bits.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        r: 2 + Math.random() * 5,
        color,
        life: 0,
        max: 0.5 + Math.random() * 0.5,
      });
    }
  }

  private draw(now: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.scale, this.scale);
    // Nothing may spill into the letterbox bars.
    ctx.beginPath();
    ctx.rect(0, 0, DESIGN_W, DESIGN_H);
    ctx.clip();

    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    ctx.drawImage(this.bg, 0, 0, DESIGN_W, DESIGN_H);

    this.cauldrons[0].draw(ctx, now, asset("cauldron-p1"), hazardCauldron("cauldron-p1"));
    this.cauldrons[1].draw(ctx, now, asset("cauldron-p2"), hazardCauldron("cauldron-p2"));

    for (const h of this.halves) this.half(h);
    for (const it of this.items) this.item(it, now);

    for (const fx of this.magic) drawMagic(ctx, fx);

    for (const p of this.bits) {
      const fade = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, fade);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.5 + fade * 0.5), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const t of this.texts) {
      const fade = 1 - Math.max(0, (t.life - t.max * 0.55) / (t.max * 0.45));
      ctx.globalAlpha = Math.max(0, Math.min(1, fade));
      ctx.fillStyle = t.color;
      ctx.font = `700 ${t.size}px Fredoka, ui-rounded, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(26,20,51,0.55)";
      ctx.lineWidth = 6;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    this.blade(0, now);
    this.blade(1, now);

    if (this.acid > 0.01) {
      ctx.fillStyle = `rgba(155, 255, 60, ${this.acid})`;
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    }
    ctx.restore();
  }

  private item(it: Item, now: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(it.rot * 0.6);
    if (it.hazard) {
      const img = asset("hazard-spiky-warning");
      if (img) ctx.drawImage(img, -it.r * 1.45, -it.r * 1.45, it.r * 2.9, it.r * 2.9);
      ctx.restore();
      ctx.save();
      ctx.font = "700 22px Fredoka, ui-rounded, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#9BFF3C";
      ctx.strokeStyle = "rgba(26,20,51,0.7)";
      ctx.lineWidth = 6;
      const bob = Math.sin(now / 260) * 4;
      ctx.strokeText("DON’T SLICE!", it.x, it.y - it.r * 1.85 + bob);
      ctx.fillText("DON’T SLICE!", it.x, it.y - it.r * 1.85 + bob);
      ctx.restore();
      return;
    }
    const img = it.kindId ? asset(it.kindId) : null;
    if (img) ctx.drawImage(img, -it.r, -it.r, it.r * 2, it.r * 2);
    ctx.restore();
  }

  private half(h: Half): void {
    const ctx = this.ctx;
    const img = asset(`${h.kindId}-${h.which === 0 ? "a" : "b"}`);
    const fade = h.life < 1.2 ? 1 : Math.max(0, 1 - (h.life - 1.2) / 0.6);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(h.x, h.y);
    ctx.rotate(h.rot);
    if (img) ctx.drawImage(img, -h.r, -h.r, h.r * 2, h.r * 2);
    ctx.restore();
  }

  private blade(side: Side, now: number): void {
    const ctx = this.ctx;
    const p = this.players[side];
    p.blade.draw(ctx, TINT[side]);
    if (!this.running) return;

    const slashing = now < p.slashUntil;
    this.wand(side, p.cursor.x, p.cursor.y, slashing);

    if (p.combo > 1 && now - p.comboAt < 900) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - (now - p.comboAt) / 900);
      ctx.font = "700 38px Fredoka, ui-rounded, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#FFD54A";
      ctx.strokeStyle = "rgba(26,20,51,0.6)";
      ctx.lineWidth = 7;
      const label = `${p.combo}× COMBO!`;
      ctx.strokeText(label, p.cursor.x, p.cursor.y - 84);
      ctx.fillText(label, p.cursor.x, p.cursor.y - 84);
      ctx.restore();
    }

    if (!p.present) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = "600 22px Fredoka, ui-rounded, system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillText("waiting for a hand", side === 0 ? 480 : 1440, 860);
      ctx.restore();
    }
  }

  /**
   * Wand sprite, with the star tip pinned exactly to the cursor. The tip sits
   * at (112, 15) in the 144px source art, so the sprite is offset by that much
   * before drawing — the cut point and the visible point are the same place.
   */
  private wand(side: Side, x: number, y: number, slashing: boolean): void {
    const name = side === 0 ? (slashing ? "wand-p1-slash" : "wand-p1") : slashing ? "wand-p2-slash" : "wand-p2";
    const img = asset(name);
    if (!img) return;
    const ctx = this.ctx;
    const TIP_X = 112;
    const TIP_Y = 15;
    const src = img as HTMLImageElement | HTMLCanvasElement;
    const w = (src instanceof HTMLImageElement ? src.naturalWidth : src.width) || 144;
    const h = (src instanceof HTMLImageElement ? src.naturalHeight : src.height) || 144;
    ctx.save();
    ctx.translate(x, y);
    if (side === 1) {
      // Player 2's wand points the other way.
      ctx.scale(-1, 1);
      ctx.rotate(0.08);
    } else {
      ctx.rotate(-0.08);
    }
    ctx.drawImage(img, -TIP_X, -TIP_Y, w, h);
    ctx.restore();
  }
}
