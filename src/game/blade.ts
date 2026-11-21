const TAU = Math.PI * 2;
const TRAIL_MS = 260;
const MAX_JUMP_PX = 460;

export interface TrailPoint {
  x: number;
  y: number;
  t: number;
  /** Cursor speed at this sample, px/s. */
  v: number;
  /** How hard the speed changed into this sample, px/s². */
  a: number;
}

export interface Segment {
  from: TrailPoint;
  to: TrailPoint;
  angle: number;
  speed: number;
}

export class Blade {
  points: TrailPoint[] = [];

  clear(): void {
    this.points.length = 0;
  }

  /**
   * Record a cursor sample. Returns the movement segment when it is a plausible
   * swipe (not a teleport, not a stall), so the game can test it for hits.
   */
  add(x: number, y: number, active: boolean): Segment | null {
    if (!active) {
      this.points.length = 0;
      return null;
    }
    const now = performance.now();
    const last = this.points[this.points.length - 1];

    if (!last) {
      this.points.push({ x, y, t: now, v: 0, a: 0 });
      return null;
    }

    const dist = Math.hypot(x - last.x, y - last.y);
    if (dist < 1.5) return null;

    const dt = Math.max(1, now - last.t) / 1000;
    const speed = dist / dt;
    const accel = Math.abs(speed - last.v) / dt;
    this.points.push({ x, y, t: now, v: speed, a: accel });
    this.trim(now);

    if (dist > MAX_JUMP_PX) return null;
    return {
      from: last,
      to: this.points[this.points.length - 1],
      angle: Math.atan2(y - last.y, x - last.x),
      speed,
    };
  }

  /**
   * Draw the swipe. Each segment's thickness comes from how fast the cursor was
   * moving and how hard it accelerated into that point, so a hard flick lays
   * down a fat streak while a lazy drift stays thin.
   */
  draw(ctx: CanvasRenderingContext2D, tint = "#8ce6ff"): void {
    const pts = this.points;
    if (pts.length < 2) return;
    const now = performance.now();

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i];
        const age = 1 - (now - p.t) / TRAIL_MS;
        if (age <= 0) continue;

        const grow = 0.4 + 0.6 * (i / pts.length);
        const heat = Math.min(1, p.v / 2200);
        const snap = Math.min(1, p.a / 12000);
        const thickness = 0.45 + heat * 1.25 + snap * 1.5;
        ctx.lineWidth = (pass === 0 ? 22 : 8) * thickness * age * grow;

        if (pass === 0) {
          ctx.strokeStyle = tint;
          ctx.globalAlpha = (0.1 + 0.16 * heat) * age;
          ctx.shadowColor = tint;
          ctx.shadowBlur = 24 * heat;
        } else {
          ctx.strokeStyle = "#ffffff";
          ctx.globalAlpha = (0.72 + 0.28 * heat) * age;
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private trim(now: number): void {
    while (this.points.length > 1 && now - this.points[0].t > TRAIL_MS) this.points.shift();
  }
}

export function segmentHitsCircle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  cx: number,
  cy: number,
  r: number,
): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 1e-6) t = ((cx - a.x) * dx + (cy - a.y) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = a.x + dx * t;
  const py = a.y + dy * t;
  return Math.hypot(cx - px, cy - py) <= r;
}

export { TAU };
