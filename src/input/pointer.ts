import type { Sample } from "./types";

/**
 * The macOS cursor. AirPointer (AirPods) drives it from outside the browser, so
 * this is the whole input path for the left player: no buttons, no bridge.
 */
export class PointerDriver {
  onSample: ((s: Sample) => void) | null = null;

  private last = { x: 0.5, y: 0.5 };
  private target: EventTarget;

  constructor(target: EventTarget = window) {
    this.target = target;
  }

  async start(): Promise<void> {
    this.target.addEventListener("pointermove", this.move);
    this.target.addEventListener("pointerdown", this.move);
  }

  stop(): void {
    this.target.removeEventListener("pointermove", this.move);
    this.target.removeEventListener("pointerdown", this.move);
  }

  private move = (e: Event) => {
    const p = e as PointerEvent;
    if (!Number.isFinite(p.clientX) || !Number.isFinite(p.clientY)) return;
    this.last = {
      x: p.clientX / Math.max(1, window.innerWidth),
      y: p.clientY / Math.max(1, window.innerHeight),
    };
    this.onSample?.({ x: this.last.x, y: this.last.y, active: true, t: performance.now() });
  };
}
