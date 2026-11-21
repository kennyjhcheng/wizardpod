export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

const TAU = Math.PI * 2;

function brick(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  radius = 14,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = color;
  ctx.fill();
}

function bottle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  liquid: string,
): void {
  const glass = "rgba(255,255,255,0.14)";
  ctx.beginPath();
  ctx.roundRect(x, y + h * 0.32, w, h * 0.68, w * 0.34);
  ctx.fillStyle = glass;
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x + w * 0.32, y, w * 0.36, h * 0.42, 4);
  ctx.fillStyle = glass;
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x + w * 0.04, y + h * 0.5, w * 0.92, h * 0.46, w * 0.3);
  ctx.fillStyle = liquid;
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x + w * 0.28, y - h * 0.08, w * 0.44, h * 0.12, 4);
  ctx.fillStyle = "rgba(58,40,86,0.9)";
  ctx.fill();
}

function shelf(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.fillStyle = "rgba(36, 22, 62, 0.85)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, 14, 6);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillRect(x, y, w, 3);
}

/** The workshop: walls, arch, shelves, counters, floor and divider. */
export function paintScene(canvas: HTMLCanvasElement): void {
  canvas.width = DESIGN_W;
  canvas.height = DESIGN_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const wall = ctx.createLinearGradient(0, 0, 0, DESIGN_H);
  wall.addColorStop(0, "#3a2f68");
  wall.addColorStop(0.52, "#463573");
  wall.addColorStop(1, "#2b2150");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

  // Light pools under the cauldrons.
  for (const [cx, tint] of [
    [480, "rgba(96,132,230,0.20)"],
    [1440, "rgba(255,150,70,0.18)"],
  ] as const) {
    const g = ctx.createRadialGradient(cx, 560, 40, cx, 560, 520);
    g.addColorStop(0, tint);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - 520, 0, 1040, DESIGN_H);
  }

  // Masonry.
  const bricks: [number, number, number, number][] = [
    [76, 94, 133, 49],
    [222, 143, 93, 46],
    [470, 66, 119, 48],
    [650, 179, 101, 45],
    [51, 345, 115, 49],
    [185, 397, 94, 43],
    [813, 106, 86, 45],
    [1052, 104, 115, 47],
    [1201, 45, 83, 43],
    [1650, 65, 130, 45],
    [1801, 124, 104, 49],
    [1045, 339, 82, 48],
    [1816, 409, 104, 45],
    [1069, 593, 78, 45],
    [1775, 578, 112, 46],
  ];
  for (const [x, y, w, h] of bricks) brick(ctx, x, y, w, h, "rgba(255,255,255,0.055)");

  // Right arch.
  ctx.beginPath();
  ctx.moveTo(1190, 842);
  ctx.lineTo(1190, 400);
  ctx.quadraticCurveTo(1440, 150, 1690, 400);
  ctx.lineTo(1690, 842);
  ctx.closePath();
  ctx.fillStyle = "rgba(24, 15, 46, 0.55)";
  ctx.fill();

  for (let i = 0; i < 15; i++) {
    const a = Math.PI + (i / 14) * Math.PI;
    const cx = 1440 + Math.cos(a) * 268;
    const cy = 400 + Math.sin(a) * 250;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a + Math.PI / 2);
    brick(ctx, -34, -44, 68, 88, "#6a4f9e", 20);
    ctx.restore();
  }
  brick(ctx, 1126, 430, 59, 96, "#6a4f9e", 20);
  brick(ctx, 1126, 536, 59, 94, "#6a4f9e", 20);
  brick(ctx, 1695, 430, 59, 96, "#6a4f9e", 20);
  brick(ctx, 1695, 536, 59, 94, "#6a4f9e", 20);

  // Shelves and bottles: left.
  shelf(ctx, 738, 500, 162);
  shelf(ctx, 738, 620, 162);
  bottle(ctx, 746, 400, 62, 106, "rgba(120, 220, 255, 0.55)");
  bottle(ctx, 829, 384, 44, 122, "rgba(255, 190, 120, 0.5)");
  bottle(ctx, 754, 520, 41, 113, "rgba(180, 130, 255, 0.5)");
  bottle(ctx, 815, 560, 61, 71, "rgba(120, 240, 190, 0.45)");
  bottle(ctx, 18, 599, 79, 101, "rgba(140, 200, 255, 0.42)");
  bottle(ctx, 133, 623, 59, 77, "rgba(255, 170, 120, 0.4)");

  // Shelves and bottles: right.
  shelf(ctx, 1765, 490, 155);
  shelf(ctx, 1765, 604, 155);
  bottle(ctx, 1770, 388, 58, 102, "rgba(255, 170, 90, 0.55)");
  bottle(ctx, 1845, 404, 57, 86, "rgba(255, 210, 120, 0.5)");
  bottle(ctx, 1776, 500, 43, 116, "rgba(160, 120, 255, 0.5)");
  bottle(ctx, 1841, 550, 57, 66, "rgba(255, 120, 200, 0.45)");
  bottle(ctx, 1749, 622, 59, 78, "rgba(150, 230, 200, 0.4)");
  bottle(ctx, 1837, 597, 76, 103, "rgba(255, 190, 110, 0.42)");

  // Counters.
  brick(ctx, 0, 695, 285, 147, "rgba(46, 30, 74, 0.9)", 10);
  brick(ctx, 1635, 695, 285, 147, "rgba(46, 30, 74, 0.9)", 10);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, 695, 285, 8);
  ctx.fillRect(1635, 695, 285, 8);

  // Floor.
  ctx.fillStyle = "rgba(18, 12, 34, 0.35)";
  ctx.fillRect(0, 828, DESIGN_W, 16);
  const floor = ctx.createLinearGradient(0, 830, 0, DESIGN_H);
  floor.addColorStop(0, "#372a5e");
  floor.addColorStop(1, "#241a44");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 830, DESIGN_W, DESIGN_H - 830);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fillRect(0, 830, DESIGN_W, 4);

  // Divider.
  ctx.fillStyle = "#1a1334";
  ctx.fillRect(957, 0, 6, DESIGN_H);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(957, 0, 2, DESIGN_H);

  // Vignette.
  const vig = ctx.createRadialGradient(DESIGN_W / 2, DESIGN_H / 2, 460, DESIGN_W / 2, DESIGN_H / 2, 1200);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.32)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

  void TAU;
}
