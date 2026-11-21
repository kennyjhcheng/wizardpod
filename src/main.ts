import { Game, type RunResult, type SideView, TARGET_SCORE } from "./game/game";
import { byId, iconUrl } from "./game/ingredients";
import { HandDriver } from "./input/hand";
import { PointerDriver } from "./input/pointer";
import { DESIGN_H, DESIGN_W } from "./game/scene";
import { initAudio } from "./game/sound";
import { startMusic, stopMusic } from "./game/music";

/** `?demo` swaps the two real inputs for the scripted arcs in `demo.ts`. */
const demoMode = new URLSearchParams(window.location.search).has("demo");

const pick = <T extends Element>(selector: string): T => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
};

const canvas = pick<HTMLCanvasElement>("#stage");
const frame = pick<HTMLElement>("#frame");
const intro = pick<HTMLElement>("#intro");
const over = pick<HTMLElement>("#over");
const introHint = pick<HTMLElement>("#introHint");
const startBtn = pick<HTMLButtonElement>("#startBtn");
const againBtn = pick<HTMLButtonElement>("#againBtn");
const scoreLeft = pick<HTMLElement>("#scoreLeft");
const scoreRight = pick<HTMLElement>("#scoreRight");
const clock = pick<HTMLElement>("#clock");
const overWinner = pick<HTMLElement>("#overWinner");
const overLeft = pick<HTMLElement>("#overLeft");
const overRight = pick<HTMLElement>("#overRight");

const cards = [
  {
    root: pick<HTMLElement>("#recipeLeft"),
    name: pick<HTMLElement>("#recipeLeftName"),
    slots: pick<HTMLElement>("#recipeLeft .recipe__items"),
    progress: pick<HTMLElement>("#recipeLeftProgress"),
    tray: pick<HTMLElement>("#trayLeft"),
  },
  {
    root: pick<HTMLElement>("#recipeRight"),
    name: pick<HTMLElement>("#recipeRightName"),
    slots: pick<HTMLElement>("#recipeRight .recipe__items"),
    progress: pick<HTMLElement>("#recipeRightProgress"),
    tray: pick<HTMLElement>("#trayRight"),
  },
] as const;

const game = new Game(canvas);
game.onEnd = (result) => showOver(result);

// --- left player: the macOS cursor, moved by AirPointer -----------------------
const pointer = new PointerDriver();
pointer.onSample = (s) => game.input(0, s);
if (!demoMode) void pointer.start();

// --- right player: one hand on the webcam ------------------------------------
const hand = new HandDriver(null);
hand.onSample = (s) => game.input(1, s);
hand.onStatus = (status) => {
  if (status.state === "error") introHint.textContent = `${status.detail} — player 2 needs camera access.`;
  game.setPresent(1, status.state === "live");
};

// --- layout ------------------------------------------------------------------
function layoutFrame(): void {
  const k = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
  const ox = (window.innerWidth - DESIGN_W * k) / 2;
  const oy = (window.innerHeight - DESIGN_H * k) / 2;
  frame.style.transform = `translate(${ox}px, ${oy}px) scale(${k})`;
  game.resize();
}

// --- HUD painting ------------------------------------------------------------
function fillSlots(root: Element, ids: string[]): void {
  root.querySelectorAll<HTMLElement>(".slot").forEach((slot, i) => {
    const id = ids[i];
    if (!id) {
      slot.style.backgroundImage = "";
      slot.dataset.kind = "";
      return;
    }
    slot.style.backgroundImage = `url(${iconUrl(byId(id))})`;
    slot.dataset.kind = id;
  });
}

function paintRecipe(side: 0 | 1, view: SideView): void {
  const card = cards[side];
  card.name.textContent = view.recipeName;
  fillSlots(card.slots, view.recipeItems);
  fillSlots(card.tray, view.pool);
}

// --- new-recipe entrance ------------------------------------------------------
const BURST_COLORS: [string[], string[]] = [
  ["#7FA3E8", "#4A7BD0", "#FFD54A", "#FFF3C4"],
  ["#FFB066", "#FF8A2B", "#FFD54A", "#FFF3C4"],
];

/** The card pops in out of a burst of sparks, and its tray jolts with it. */
function burstIn(side: 0 | 1): void {
  const card = cards[side];
  const colors = BURST_COLORS[side];
  const layer = document.createElement("div");
  layer.className = "burst";

  const ring = document.createElement("span");
  ring.className = "burst__ring";
  ring.style.setProperty("--c", colors[0]);
  layer.append(ring);

  for (let i = 0; i < 18; i++) {
    const spark = document.createElement("span");
    const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.35;
    const distance = 90 + Math.random() * 110;
    spark.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    spark.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    spark.style.setProperty("--c", colors[i % colors.length]);
    spark.style.animationDelay = `${Math.random() * 70}ms`;
    layer.append(spark);
  }

  card.root.append(layer);
  card.root.classList.remove("is-new");
  card.tray.classList.remove("is-new");
  void card.root.offsetWidth;
  card.root.classList.add("is-new");
  card.tray.classList.add("is-new");

  window.setTimeout(() => {
    layer.remove();
    card.root.classList.remove("is-new");
    card.tray.classList.remove("is-new");
  }, 820);
}

function paintCollected(side: 0 | 1, collected: boolean[]): void {
  cards[side].slots.querySelectorAll<HTMLElement>(".slot").forEach((slot, i) => {
    slot.classList.toggle("is-done", Boolean(collected[i]));
  });
  const done = collected.filter(Boolean).length;
  cards[side].progress.textContent = `${done} / 3 ingredients collected`;
}

function clockText(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const lastRecipe = ["", ""];

function refresh(): void {
  const snap = game.snapshot();
  scoreLeft.textContent = snap.left.score.toLocaleString("en-US");
  scoreRight.textContent = snap.right.score.toLocaleString("en-US");
  clock.textContent = clockText(snap.seconds);

  ([snap.left, snap.right] as SideView[]).forEach((view, i) => {
    const side = i as 0 | 1;
    if (view.recipeName !== lastRecipe[side]) {
      const firstPaint = lastRecipe[side] === "";
      lastRecipe[side] = view.recipeName;
      paintRecipe(side, view);
      if (!firstPaint) burstIn(side);
    }
    paintCollected(side, view.collected);
  });
}

function renderFrame(): void {
  layoutFrame();
  refresh();
}

function showOver(result: RunResult): void {
  stopMusic();
  overWinner.textContent =
    result.winner === 0 ? "A DEAD HEAT" : result.winner === 1 ? "PLAYER 1 WINS" : "PLAYER 2 WINS";
  overLeft.textContent = result.scores[0].toLocaleString("en-US");
  overRight.textContent = result.scores[1].toLocaleString("en-US");
  over.classList.remove("hidden");
  document.body.classList.remove("is-playing");
}

let cameraReady = false;
let cameraStarting = false;

/** Hand tracking loads in the background so the round can start right away. */
async function ensureCamera(): Promise<void> {
  if (demoMode) return;
  if (cameraReady || cameraStarting) return;
  cameraStarting = true;
  try {
    await hand.start();
    cameraReady = true;
    game.setPresent(1, true);
  } catch (err) {
    introHint.textContent = `${(err as Error).message} — player 2 will wait.`;
    game.setPresent(1, false);
  } finally {
    cameraStarting = false;
  }
}

function startRound(): void {
  initAudio();
  startMusic();
  void ensureCamera();

  game.start();
  lastRecipe[0] = "";
  lastRecipe[1] = "";
  intro.classList.add("hidden");
  over.classList.add("hidden");
  document.body.classList.add("is-playing");
  refresh();
}

startBtn.addEventListener("click", startRound);
againBtn.addEventListener("click", startRound);

window.addEventListener("resize", renderFrame);
window.addEventListener("orientationchange", () => setTimeout(renderFrame, 120));

renderFrame();
void document.fonts?.ready.then(renderFrame);

if (demoMode) {
  void import("./demo").then((m) => m.attachDemo(game));
} else {
  // Warm the hand tracker while the title screen is up, so Start is instant.
  introHint.textContent = "Loading hand tracking…";
  void ensureCamera();
}

// Keep the HUD in step with the game without redrawing text every frame.
window.setInterval(refresh, 120);

console.info(`WizardPod — first to ${TARGET_SCORE.toLocaleString("en-US")} points.`);
