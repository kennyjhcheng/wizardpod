import type { Game, Side } from "./game/game";

/**
 * Scripted two-player demo, loaded only for `?demo`.
 *
 * Real input comes from AirPods (the macOS cursor) and a webcam hand, so a
 * recording needs both a head tracker and a camera. This plays the same two
 * blades instead: each side eases toward the ingredients its recipe needs,
 * swerves around hazards and keeps to its own half. Nothing here is a separate
 * renderer — README media is captured from the real game running this.
 */

const SPEED = 820; // px/s along the stage
const SAFE_MARGIN = 54; // how far a swipe must clear a hazard by

interface Point {
  x: number;
  y: number;
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 1e-6) t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

export function attachDemo(game: Game): void {
  const start = document.querySelector<HTMLButtonElement>("#startBtn");
  const again = document.querySelector<HTMLButtonElement>("#againBtn");
  const over = document.querySelector<HTMLElement>("#over");

  game.setPresent(1, true);
  start?.click();

  const cursor: [Point, Point] = [
    { x: 480, y: 640 },
    { x: 1430, y: 640 },
  ];
  const orbitAt = [0, 0];
  const home: [Point, Point] = [
    { x: 480, y: 560 },
    { x: 1440, y: 560 },
  ];

  let restartAt = 0;
  let last = performance.now();

  const tick = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;

    const items = game.liveItems();
    const snap = game.snapshot();

    for (const side of [0, 1] as Side[]) {
      const view = side === 0 ? snap.left : snap.right;
      const wanted = new Set([...view.recipeItems, "golden-bonus"]);
      const mine = items.filter((it) => it.side === side);
      const hazards = mine.filter((it) => it.hazard);
      const me = cursor[side];

      let best: Point | null = null;
      let bestDistance = Infinity;
      for (const it of mine) {
        if (it.hazard || !it.kindId || !wanted.has(it.kindId)) continue;
        const d = Math.hypot(it.x - me.x, it.y - me.y);
        if (d > 620) continue;
        // Skip anything that would drag the blade through a hazard.
        if (hazards.some((h) => distanceToSegment(h, me, it) < h.r + SAFE_MARGIN)) continue;
        if (d < bestDistance) {
          bestDistance = d;
          best = it;
        }
      }

      let goal: Point;
      if (best) {
        goal = { x: best.x, y: best.y };
      } else {
        // Nothing safe to cut: drift around the half the way a player would.
        if (now > orbitAt[side]) orbitAt[side] = now + 1400 + Math.random() * 900;
        const angle = now / 900 + side * 2.1;
        goal = {
          x: home[side].x + Math.sin(angle) * 210,
          y: home[side].y + Math.cos(angle * 0.8) * 150,
        };
      }

      const dx = goal.x - me.x;
      const dy = goal.y - me.y;
      const distance = Math.hypot(dx, dy) || 1;
      const step = Math.min(distance, SPEED * dt);
      cursor[side] = { x: me.x + (dx / distance) * step, y: me.y + (dy / distance) * step };
      game.inputDesign(side, cursor[side].x, cursor[side].y, true);
    }

    void t;
    game.setPresent(1, true);

    // Keep the round rolling so a long recording never lands on the results card.
    if (over && !over.classList.contains("hidden")) {
      if (!restartAt) restartAt = performance.now() + 900;
      if (performance.now() > restartAt) {
        restartAt = 0;
        cursor[0] = { x: 480, y: 640 };
        cursor[1] = { x: 1430, y: 640 };
        game.setPresent(1, true);
        again?.click();
      }
    }

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}
