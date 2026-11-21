/**
 * Tiny WebAudio synth for the wizard slice effects — no audio files, every
 * sound is built from oscillators and a noise buffer, so it stays in sync with
 * the visuals and costs nothing to load.
 */

export type MagicSound = "lightning" | "runes" | "starburst" | "spiral";

let audio: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

/** Call from a user gesture (the Start button) so the browser lets us play. */
export function initAudio(): void {
  if (audio) {
    if (audio.state === "suspended") void audio.resume();
    return;
  }
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;

  try {
    audio = new Ctor();
  } catch {
    audio = null;
    return;
  }
  master = audio.createGain();
  master.gain.value = 0.95;

  // Loud on purpose — the compressor keeps combo stacks from clipping.
  const comp = audio.createDynamicsCompressor();
  comp.threshold.value = -6;
  comp.ratio.value = 3;
  comp.attack.value = 0.004;
  comp.release.value = 0.18;
  master.connect(comp);
  comp.connect(audio.destination);

  noise = makeNoise(audio, 1);
}

function makeNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function audioCtx(): AudioContext | null {
  return audio;
}

/** Everything musical lands here, so the mix stays in one place. */
export function audioMaster(): AudioNode | null {
  return master;
}

/** Destination for one player's sound, panned to their side of the arena. */
function channel(side: number): AudioNode | null {
  if (!audio || !master) return null;
  if (typeof audio.createStereoPanner !== "function") return master;
  const pan = audio.createStereoPanner();
  pan.pan.value = Math.max(-1, Math.min(1, side === 0 ? -0.4 : 0.4));
  pan.connect(master);
  return pan;
}

function envelope(param: AudioParam, at: number, peak: number, attack: number, duration: number): void {
  param.setValueAtTime(0.0001, at);
  param.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  param.exponentialRampToValueAtTime(0.0001, at + attack + duration);
}

export interface ToneSpec {
  type?: OscillatorType;
  from: number;
  to?: number;
  duration?: number;
  gain?: number;
  at?: number;
  detune?: number;
}

export function tone(dest: AudioNode, spec: ToneSpec): void {
  if (!audio) return;
  const { type = "sine", from, to = from, duration = 0.3, gain = 0.2, at = audio.currentTime, detune = 0 } = spec;
  const osc = audio.createOscillator();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(from, at);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + duration);

  const amp = audio.createGain();
  envelope(amp.gain, at, gain, Math.min(0.02, duration * 0.25), duration);
  osc.connect(amp);
  amp.connect(dest);
  osc.start(at);
  osc.stop(at + duration + 0.05);
}

export interface NoiseSpec {
  type?: BiquadFilterType;
  freq: number;
  to?: number;
  q?: number;
  duration?: number;
  gain?: number;
  at?: number;
}

export function hiss(dest: AudioNode, spec: NoiseSpec): void {
  if (!audio || !noise) return;
  const { type = "bandpass", freq, to = freq, q = 1, duration = 0.2, gain = 0.2, at = audio.currentTime } = spec;
  const src = audio.createBufferSource();
  src.buffer = noise;

  const filter = audio.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, at);
  if (to !== freq) filter.frequency.exponentialRampToValueAtTime(to, at + duration);

  const amp = audio.createGain();
  envelope(amp.gain, at, gain, 0.006, duration);

  src.connect(filter);
  filter.connect(amp);
  amp.connect(dest);
  src.start(at);
  src.stop(at + duration + 0.05);
}

/**
 * Slicing a hazard: dissonant saw cluster sliding down into a sub drop and a
 * low crunch — the one sound in the game that is supposed to feel bad.
 */
export function hazardSound(side = 0): void {
  if (!audio || !master) return;
  if (audio.state === "suspended") void audio.resume();
  const dest = channel(side);
  if (!dest) return;
  const t = audio.currentTime + 0.002;

  // Three detuned saws a semitone-ish apart, sagging by two octaves.
  for (const base of [176, 187, 93]) {
    const osc = audio.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 0.26, t + 0.5);

    const filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 9;
    filter.frequency.setValueAtTime(2600, t);
    filter.frequency.exponentialRampToValueAtTime(180, t + 0.5);

    const amp = audio.createGain();
    envelope(amp.gain, t, 0.26, 0.008, 0.54);

    osc.connect(filter);
    filter.connect(amp);
    amp.connect(dest);
    osc.start(t);
    osc.stop(t + 0.62);
  }

  // Sub drop and a gritty crunch underneath.
  tone(dest, { type: "sine", from: 130, to: 32, duration: 0.5, gain: 0.5, at: t });
  hiss(dest, { type: "lowpass", freq: 1400, to: 130, q: 1.2, duration: 0.36, gain: 0.38, at: t });

  // A sour little sting on top so it cuts through the music.
  tone(dest, { type: "square", from: 1180, to: 940, duration: 0.18, gain: 0.075, at: t });
  tone(dest, { type: "square", from: 1249, to: 995, duration: 0.18, gain: 0.075, at: t + 0.012 });
}

/** Play the sound that matches an effect. `side` 0 = left, 1 = right. */
export function magicSound(kind: MagicSound, side = 0): void {
  if (!audio || !master) return;
  if (audio.state === "suspended") void audio.resume();
  const dest = channel(side);
  if (!dest) return;
  const t = audio.currentTime + 0.002;

  switch (kind) {
    case "lightning": {
      // Crack: bright noise slamming down in pitch, plus a low thump.
      hiss(dest, { duration: 0.2, gain: 0.5, freq: 3400, to: 420, q: 0.7, at: t });
      hiss(dest, { type: "highpass", duration: 0.07, gain: 0.28, freq: 4200, at: t });
      tone(dest, { type: "square", from: 200, to: 46, duration: 0.15, gain: 0.14, at: t });
      // A couple of sputtering ticks along the bolt.
      for (let i = 0; i < 3; i++) {
        hiss(dest, {
          duration: 0.03,
          gain: 0.11,
          freq: 1600 + Math.random() * 2200,
          q: 1.4,
          at: t + 0.05 + Math.random() * 0.13,
        });
      }
      break;
    }

    case "runes": {
      // Rising bell arpeggio, slightly detuned for a magical shimmer.
      const root = 523.25 * (1 + (Math.random() - 0.5) * 0.012);
      [0, 4, 7, 12].forEach((semi, i) => {
        const f = root * 2 ** (semi / 12);
        const at = t + i * 0.046;
        tone(dest, {
          type: "triangle",
          from: f,
          duration: 0.55 - i * 0.06,
          gain: 0.13,
          at,
          detune: (Math.random() - 0.5) * 10,
        });
        tone(dest, { type: "sine", from: f * 2, duration: 0.28, gain: 0.045, at });
      });
      hiss(dest, { type: "highpass", duration: 0.42, gain: 0.045, freq: 6200, at: t });
      break;
    }

    case "starburst": {
      // Whistle up into a bright ping.
      tone(dest, { from: 700, to: 2500, duration: 0.12, gain: 0.18, at: t });
      tone(dest, { type: "triangle", from: 1750, to: 3100, duration: 0.09, gain: 0.08, at: t + 0.015 });
      hiss(dest, { duration: 0.16, gain: 0.18, freq: 5200, to: 9500, q: 2.2, at: t });
      tone(dest, { from: 2600, duration: 0.26, gain: 0.06, at: t + 0.05 });
      break;
    }

    case "spiral": {
      // Warbly swirl: detuned triangles under an opening filter, with an LFO.
      const duration = 0.5;
      const filter = audio.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 6;
      filter.frequency.setValueAtTime(380, t);
      filter.frequency.exponentialRampToValueAtTime(3200, t + duration);

      const amp = audio.createGain();
      envelope(amp.gain, t, 0.11, 0.05, duration);
      filter.connect(amp);
      amp.connect(dest);

      for (const detune of [-11, 0, 9]) {
        const osc = audio.createOscillator();
        osc.type = "triangle";
        osc.detune.value = detune;
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(1150, t + duration);

        const lfo = audio.createOscillator();
        lfo.frequency.value = 6.5 + Math.random() * 3.5;
        const wobble = audio.createGain();
        wobble.gain.value = 28;
        lfo.connect(wobble);
        wobble.connect(osc.detune);

        osc.connect(filter);
        osc.start(t);
        osc.stop(t + duration + 0.05);
        lfo.start(t);
        lfo.stop(t + duration + 0.05);
      }

      hiss(dest, { duration, gain: 0.06, freq: 480, to: 4200, q: 3, at: t });
      break;
    }
  }
}
