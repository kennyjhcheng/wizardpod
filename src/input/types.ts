/** A blade position in normalised screen space (0..1 on both axes). */
export interface Sample {
  x: number;
  y: number;
  /** False means "the blade is lifted": the trail is cleared and nothing is cut. */
  active: boolean;
  t: number;
}

export type StatusState = "idle" | "connecting" | "live" | "error";

export interface Status {
  state: StatusState;
  detail: string;
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
