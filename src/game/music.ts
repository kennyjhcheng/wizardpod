/**
 * Intense background music, synthesised on the fly: 138 BPM in A minor with a
 * driving saw bass, arpeggio, four-on-the-floor kick and breakbeat hats.
 * A step scheduler keeps it locked to the audio clock instead of setInterval
 * jitter.
 */

import { audioCtx, audioMaster, hiss, tone } from "./sound";

const BPM = 138;
const SIXTEENTH = 60 / BPM / 4;
const STEPS = 64; // four bars

interface Bar {
  bass: number;
  chord: number[];
}

// Am – F – G – E: the classic ominous loop.
const BARS: Bar[] = [
  { bass: 55.0, chord: [220.0, 261.63, 329.63] },
  { bass: 43.65, chord: [174.61, 220.0, 261.63] },
  { bass: 49.0, chord: [196.0, 246.94, 293.66] },
  { bass: 41.2, chord: [164.81, 207.65, 246.94] },
];

const BASS_PATTERN = [0, 0, 12, 0, 7, 0, 12, 10];
const ARP_PATTERN = [0, 1, 2, 1, 0, 2, 1, 2];

let bus: GainNode | null = null;
let timer: number | null = null;
let step = 0;
let nextTime = 0;

export function musicPlaying(): boolean {
  return timer !== null;
}

export function startMusic(): void {
  const ctx = audioCtx();
  const out = audioMaster();
  if (!ctx || !out || timer !== null) return;

  if (!bus) {
    bus = ctx.createGain();
    bus.gain.value = 0.0001;
    bus.connect(out);
  }

  bus.gain.cancelScheduledValues(ctx.currentTime);
  bus.gain.setValueAtTime(0.0001, ctx.currentTime);
  bus.gain.exponentialRampToValueAtTime(0.62, ctx.currentTime + 0.9);

  step = 0;
  nextTime = ctx.currentTime + 0.05;
  timer = window.setInterval(tick, 30);
  tick();
}

export function stopMusic(): void {
  if (timer === null) return;
  window.clearInterval(timer);
  timer = null;
  const ctx = audioCtx();
  if (!bus || !ctx) return;
  bus.gain.cancelScheduledValues(ctx.currentTime);
  bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), ctx.currentTime);
  bus.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
}

function tick(): void {
  const ctx = audioCtx();
  const dest = bus;
  if (!ctx || !dest) return;
  const horizon = ctx.currentTime + 0.22;
  let guard = 0;
  while (nextTime < horizon && guard++ < 64) {
    playStep(step, nextTime, dest);
    nextTime += SIXTEENTH;
    step = (step + 1) % STEPS;
  }
}

function playStep(index: number, at: number, dest: AudioNode): void {
  const bar = BARS[Math.floor(index / 16) % BARS.length];
  const pos = index % 16;

  // Kick, four on the floor with a pickup every other bar.
  if (pos % 4 === 0 || (pos === 14 && Math.floor(index / 16) % 2 === 1)) {
    tone(dest, { type: "sine", from: 138, to: 40, duration: 0.17, gain: 0.6, at });
  }

  // Snare.
  if (pos === 4 || pos === 12) {
    hiss(dest, { type: "bandpass", freq: 1700, q: 1.3, duration: 0.15, gain: 0.5, at });
    tone(dest, { type: "triangle", from: 215, to: 150, duration: 0.09, gain: 0.16, at });
  }

  // Hats on the off-sixteenths, open hat before the turn.
  if (pos % 2 === 1) {
    hiss(dest, { type: "highpass", freq: 7600, duration: 0.045, gain: 0.2, at });
  }
  if (pos === 14) {
    hiss(dest, { type: "highpass", freq: 6200, duration: 0.19, gain: 0.17, at });
  }

  // Saw bass on the eighths, with an octave answer.
  if (pos % 2 === 0) {
    const semis = BASS_PATTERN[(pos / 2) % BASS_PATTERN.length];
    const freq = bar.bass * 2 ** (semis / 12);
    tone(dest, { type: "sawtooth", from: freq, duration: 0.13, gain: 0.26, at });
    tone(dest, { type: "sine", from: freq, duration: 0.16, gain: 0.3, at });
  }

  // Arpeggio sparkle over the top.
  const chord = bar.chord[ARP_PATTERN[pos % ARP_PATTERN.length]];
  const noteFreq = chord * ((pos % 8 === 3 || pos % 8 === 7) ? 4 : 2);
  tone(dest, { type: "triangle", from: noteFreq, duration: 0.08, gain: 0.11, at });

  // Chord stab at the top of every bar.
  if (pos === 0) {
    for (const note of bar.chord) {
      tone(dest, { type: "sawtooth", from: note * 2, duration: 0.2, gain: 0.055, at });
    }
  }
}
