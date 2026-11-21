import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { Sample, Status } from "./types";

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/models/hand_landmarker.task";
const SMOOTHING = 0.42;
const LOST_AFTER_MS = 500;

/**
 * Right player: the index fingertip of one hand on the webcam.
 * MediaPipe gives normalised image coordinates; we mirror them (selfie view) and
 * squeeze the result into the right half of the screen.
 */
export class HandDriver {
  onSample: ((s: Sample) => void) | null = null;
  onStatus: ((s: Status) => void) | null = null;

  private landmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement;
  private preview: HTMLCanvasElement | null;
  private smooth = { x: 0.75, y: 0.5 };
  private hasHand = false;
  private lastSeen = 0;
  private raf = 0;
  private stopped = false;

  constructor(preview: HTMLCanvasElement | null = null) {
    this.video = document.createElement("video");
    this.video.playsInline = true;
    this.video.muted = true;
    this.preview = preview;
  }

  async start(): Promise<void> {
    this.onStatus?.({ state: "connecting", detail: "Starting camera…" });

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      const detail =
        name === "NotAllowedError"
          ? "Camera blocked — allow it in the address bar"
          : name === "NotFoundError"
            ? "No camera found"
            : "Camera unavailable";
      this.onStatus?.({ state: "error", detail });
      throw new Error(detail);
    }

    this.video.srcObject = this.stream;
    await this.video.play();

    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    this.landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55,
      minHandPresenceConfidence: 0.5,
    });

    this.onStatus?.({ state: "live", detail: "Tracking your hand" });
    if (this.preview) this.preview.classList.remove("hidden");
    this.loop();
  }

  stop(): void {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.landmarker?.close();
    this.landmarker = null;
    this.preview?.classList.add("hidden");
  }

  private loop = () => {
    if (this.stopped || !this.landmarker) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.video.readyState < 2) return;

    const now = performance.now();
    const result = this.landmarker.detectForVideo(this.video, now);
    this.drawPreview(result.landmarks[0] ?? null);

    const hand = result.landmarks[0];
    if (!hand) {
      if (this.hasHand && now - this.lastSeen > LOST_AFTER_MS) {
        this.hasHand = false;
        this.onSample?.({ x: this.smooth.x, y: this.smooth.y, active: false, t: now });
      }
      return;
    }

    const tip = hand[8] ?? hand[0];
    const target = this.toScreen(tip);
    this.smooth.x += (target.x - this.smooth.x) * SMOOTHING;
    this.smooth.y += (target.y - this.smooth.y) * SMOOTHING;

    this.hasHand = true;
    this.lastSeen = now;
    this.onSample?.({ x: this.smooth.x, y: this.smooth.y, active: true, t: now });
  };

  /** Mirror the image so moving right on screen moves right in the room. */
  private toScreen(lm: NormalizedLandmark): { x: number; y: number } {
    return {
      x: 0.5 + (1 - lm.x) * 0.5,
      y: lm.y,
    };
  }

  private drawPreview(hand: NormalizedLandmark[] | null): void {
    const canvas = this.preview;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width: W, height: H } = canvas;

    ctx.save();
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(this.video, 0, 0, W, H);
    ctx.restore();

    if (!hand) return;
    const tip = hand[8];
    const x = (1 - tip.x) * W;
    const y = tip.y * H;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(140, 230, 255, 0.9)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(8, 6, 15, 0.8)";
    ctx.stroke();
  }
}
