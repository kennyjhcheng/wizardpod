/**
 * Cauldron states and their effects.
 *
 * Idle and bubbling alternate on their own so the pots always feel alive; the
 * success sparkles are a short burst that runs a few loops and stops; the
 * hazard state is sticky and only clears when a recipe is finished.
 */

const TAU = Math.PI * 2;
const MAX_BUBBLES = 70;

interface Bubble {
  x: number;
  y: number;
  vy: number;
  r: number;
  life: number;
  max: number;
  phase: number;
  color: string;
}

interface Pop {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
  color: string;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  spin: number;
  life: number;
  max: number;
  color: string;
}

interface Drip {
  x: number;
  len: number;
  w: number;
  phase: number;
  speed: number;
}

const SPARK_COLORS = ["#FFD54A", "#FF9BD6", "#8ED8FF", "#FFF3C4", "#C9A0FF"];
const HAZARD_GREEN = "#8BE24A";
const HAZARD_DEEP = "#5FA83C";

export class Cauldron {
  hazard = false;

  private mood: "idle" | "bubbling" = "idle";
  private moodUntil = 0;
  private bubbleIn = 0;
  private bubbles: Bubble[] = [];
  private pops: Pop[] = [];
  private sparks: Spark[] = [];
  private sparkIn = 0;
  private successUntil = 0;
  private readonly drips: Drip[];

  private readonly rimX: number;
  private readonly rimY: number;
  private readonly surface: number;
  private readonly liquid: string;
  private readonly foam: string;

  constructor(
    private readonly side: 0 | 1,
    private readonly x: number,
    private readonly y: number,
    private readonly w: number,
    private readonly h: number,
  ) {
    this.rimX = x + w / 2;
    this.rimY = y + h * 0.19;
    this.surface = w * 0.34;
    this.liquid = side === 0 ? "#9AE7FB" : "#DCA8FF";
    this.foam = side === 0 ? "#D9F7FF" : "#F3DAFF";

    this.drips = Array.from({ length: 8 }, (_, i) => ({
      x: this.rimX - this.surface * 0.92 + (i / 7) * this.surface * 1.84,
      len: 16 + Math.random() * 28,
      w: 9 + Math.random() * 10,
      phase: Math.random() * TAU,
      speed: 0.7 + Math.random() * 0.6,
    }));
  }

  reset(): void {
    this.hazard = false;
    this.mood = "idle";
    this.moodUntil = 0;
    this.bubbleIn = 0;
    this.bubbles = [];
    this.pops = [];
    this.sparks = [];
    this.sparkIn = 0;
    this.successUntil = 0;
  }

  /** Slicing a hazard turns the brew toxic until the next recipe is done. */
  hitHazard(now: number): void {
    this.hazard = true;
    this.successUntil = 0;
    this.sparks = [];
    for (let i = 0; i < 14; i++) this.spawnBubble(true);
    void now;
  }

  /** A finished recipe: sparkles for a few loops, and the brew is clean again. */
  brew(now: number): void {
    this.hazard = false;
    this.successUntil = now + 2600;
    this.sparkIn = 0;
    // Drop any leftover toxic bubbles so the pot turns clean right away.
    this.bubbles = this.bubbles.filter((b) => b.color === this.liquid);
  }

  update(dt: number, now: number): void {
    // Idle ↔ bubbling.
    if (now > this.moodUntil) {
      this.mood = this.mood === "idle" ? "bubbling" : "idle";
      this.moodUntil = now + (this.mood === "bubbling" ? 2300 + Math.random() * 1500 : 3200 + Math.random() * 2800);
    }

    const rate = this.hazard ? 9 : this.mood === "bubbling" ? 18 : 2.4;
    this.bubbleIn -= dt;
    if (this.bubbleIn <= 0) {
      this.bubbleIn = 1 / rate;
      this.spawnBubble(this.hazard);
    }

    for (const b of this.bubbles) {
      b.life += dt;
      b.vy -= 26 * dt;
      b.y += b.vy * dt;
      b.x += Math.sin(b.life * 5.2 + b.phase) * 26 * dt;
    }

    for (const b of this.bubbles) {
      if (b.life >= b.max) {
        this.pops.push({ x: b.x, y: b.y, r: b.r, life: 0, max: 0.34, color: b.color });
      }
    }
    this.bubbles = this.bubbles.filter((b) => b.life < b.max).slice(-MAX_BUBBLES);

    for (const p of this.pops) p.life += dt;
    this.pops = this.pops.filter((p) => p.life < p.max);

    // Success sparkles, a few loops only.
    if (now < this.successUntil) {
      this.sparkIn -= dt;
      if (this.sparkIn <= 0) {
        this.sparkIn = 0.24;
        const count = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) this.spawnSpark();
      }
    }

    for (const s of this.sparks) {
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.spin * dt;
    }
    this.sparks = this.sparks.filter((s) => s.life < s.max);
  }

  private spawnBubble(toxic: boolean): void {
    const bubbling = this.mood === "bubbling";
    const r = toxic ? 6 + Math.random() * 9 : bubbling ? 7 + Math.random() * 11 : 4 + Math.random() * 6;
    this.bubbles.push({
      x: this.rimX + (Math.random() - 0.5) * this.surface * 1.7,
      y: this.rimY + (Math.random() - 0.5) * 14,
      vy: -(30 + Math.random() * 55),
      r,
      life: 0,
      max: 0.9 + Math.random() * 1.1,
      phase: Math.random() * TAU,
      color: toxic ? (Math.random() < 0.5 ? HAZARD_GREEN : HAZARD_DEEP) : this.liquid,
    });
  }

  private spawnSpark(): void {
    const a = Math.random() * TAU;
    const radius = this.surface * (0.45 + Math.random() * 0.6);
    this.sparks.push({
      x: this.rimX + Math.cos(a) * radius,
      y: this.rimY + Math.sin(a) * radius * 0.28 - 46 - Math.random() * 52,
      vx: (Math.random() - 0.5) * 26,
      vy: -46 - Math.random() * 54,
      size: 12 + Math.random() * 16,
      rot: Math.random() * TAU,
      spin: (Math.random() - 0.5) * 4,
      life: 0,
      max: 0.7 + Math.random() * 0.6,
      color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
    });
  }

  draw(ctx: CanvasRenderingContext2D, now: number, sprite: CanvasImageSource | null, toxic: CanvasImageSource | null): void {
    const img = this.hazard ? toxic ?? sprite : sprite;
    if (img) ctx.drawImage(img, this.x, this.y, this.w, this.h);

    if (this.hazard) this.drawSlime(ctx, now);
    else if (this.mood === "bubbling") this.drawFoam(ctx, now);

    for (const b of this.bubbles) this.drawBubble(ctx, b);
    for (const p of this.pops) this.drawPop(ctx, p);

    for (const s of this.sparks) this.drawSpark(ctx, s);

    ctx.globalAlpha = 1;
  }

  /** Foam mound that rolls along the rim while the pot is bubbling. */
  private drawFoam(ctx: CanvasRenderingContext2D, now: number): void {
    const t = now / 230;
    const left = this.rimX - this.surface * 0.96;
    const right = this.rimX + this.surface * 0.96;
    const top = this.rimY - 40;
    const lift = Math.sin(t) * 4;

    ctx.save();
    // The body of the foam so the bubbles read as one mass.
    ctx.beginPath();
    ctx.moveTo(left, this.rimY + 8);
    ctx.quadraticCurveTo(this.rimX - this.surface * 0.62, top - 12 + lift, this.rimX, top + lift);
    ctx.quadraticCurveTo(this.rimX + this.surface * 0.62, top - 12 - lift, right, this.rimY + 8);
    ctx.closePath();
    ctx.fillStyle = this.foam;
    ctx.globalAlpha = 0.95;
    ctx.fill();

    // Bumps riding the top edge.
    for (let row = 0; row < 2; row++) {
      const count = row === 0 ? 11 : 8;
      for (let i = 0; i < count; i++) {
        const k = i / (count - 1);
        const spread = this.surface * (row === 0 ? 0.9 : 0.62);
        const px = this.rimX - spread + k * spread * 2;
        const py = this.rimY - (row === 0 ? 16 : 30) + Math.sin(t * 1.4 + i * 1.9) * 4;
        const r = (row === 0 ? 13 : 12) + Math.sin(t * 1.7 + i * 2.3) * 4;
        ctx.globalAlpha = row === 0 ? 0.75 : 0.6;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(6, r), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** Slime running over the rim in the hazard state. */
  private drawSlime(ctx: CanvasRenderingContext2D, now: number): void {
    const t = now / 320;
    ctx.save();
    ctx.fillStyle = HAZARD_GREEN;
    // Rim coating.
    for (let i = 0; i < 11; i++) {
      const k = i / 10;
      const px = this.rimX - this.surface * 0.98 + k * this.surface * 1.96;
      const py = this.rimY + Math.sin(t + i * 0.8) * 3;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.ellipse(px, py, 22, 12, 0, 0, TAU);
      ctx.fill();
    }
    // Drips hanging off the rim.
    for (const d of this.drips) {
      const wob = Math.sin(t * d.speed + d.phase);
      const len = d.len + wob * 14;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.roundRect(d.x - d.w / 2, this.rimY - 4, d.w, len, d.w / 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(d.x, this.rimY + len - 4, d.w * 0.62, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawBubble(ctx: CanvasRenderingContext2D, b: Bubble): void {
    const fadeIn = Math.min(1, b.life / 0.18);
    const fadeOut = 1 - Math.max(0, (b.life - b.max * 0.72) / (b.max * 0.28));
    ctx.globalAlpha = Math.max(0, Math.min(1, fadeIn * fadeOut)) * 0.95;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(b.x - b.r * 0.32, b.y - b.r * 0.34, b.r * 0.3, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.stroke();
  }

  private drawPop(ctx: CanvasRenderingContext2D, p: Pop): void {
    const t = p.life / p.max;
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 3 * (1 - t) + 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (1 + t * 1.5), 0, TAU);
    ctx.stroke();

    // A couple of droplets flying off the burst.
    ctx.fillStyle = p.color;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + p.r;
      const d = p.r * (0.6 + t * 2.6);
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, Math.max(1, 3 * (1 - t)), 0, TAU);
      ctx.fill();
    }
  }

  private drawSpark(ctx: CanvasRenderingContext2D, s: Spark): void {
    const t = s.life / s.max;
    const grow = t < 0.25 ? t / 0.25 : 1;
    const fade = 1 - Math.max(0, (t - 0.55) / 0.45);
    ctx.globalAlpha = Math.max(0, Math.min(1, fade)) * grow;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    star(ctx, s.size * (0.6 + grow * 0.4), s.color);
    ctx.restore();
  }
}

/** Four-point sparkle. */
function star(ctx: CanvasRenderingContext2D, r: number, color: string): void {
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const na = a + TAU / 8;
    const inner = r * 0.22;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.quadraticCurveTo(Math.cos(na) * inner, Math.sin(na) * inner, Math.cos(a + TAU / 4) * r, Math.sin(a + TAU / 4) * r);
  }
  ctx.closePath();
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();
}
