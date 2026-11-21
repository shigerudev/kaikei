// Generates public/music.wav: an original, license-free soundtrack synthesized from scratch.
// 100 BPM, 4/4, 32 bars = 76.8 s. The arrangement is locked to the scene timeline in src/timeline.ts:
//   bars 0-5   pad only (the problem)          bar 6  impact (logo reveal)
//   bar 7      riser                           bar 8  drop: kick + bass + arp (the engine)
//   bar 12     hats + claps join               bar 29 drums out, outro chord rings to the end
// Run: node scripts/make-music.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const BPM = 100;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BARS = 32;
const DUR = BAR * BARS;
const N = Math.ceil(DUR * SR);

const L = new Float32Array(N);
const R = new Float32Array(N);
const send = new Float32Array(N); // reverb send (mono)

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 1337;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

// A minor: Am - F - C - G, two bars each.
const CHORDS = [
  { root: 45, pad: [57, 60, 64, 69] },
  { root: 41, pad: [53, 57, 60, 65] },
  { root: 48, pad: [55, 60, 64, 67] },
  { root: 43, pad: [55, 59, 62, 67] },
];
const chordAt = (bar) => CHORDS[Math.floor(bar / 2) % CHORDS.length];

function add(i, l, r, s = 0) {
  if (i < 0 || i >= N) return;
  L[i] += l;
  R[i] += r;
  send[i] += s;
}

// ---- Pad: additive, detuned, slow attack/release per chord -------------------------------------
function pad(startBar, bars, notes, gain) {
  const t0 = startBar * BAR;
  const len = bars * BAR;
  const atk = 1.2;
  const rel = 1.6;
  const i0 = Math.floor(t0 * SR);
  const i1 = Math.min(N, Math.floor((t0 + len + rel) * SR));
  notes.forEach((m, k) => {
    const f = mtof(m);
    const pan = notes.length > 1 ? (k / (notes.length - 1)) * 0.8 - 0.4 : 0;
    for (let i = i0; i < i1; i++) {
      const t = i / SR - t0;
      let env = Math.min(1, t / atk);
      if (t > len) env *= Math.max(0, 1 - (t - len) / rel);
      if (env <= 0) continue;
      let v = 0;
      for (const det of [-0.11, 0, 0.13]) {
        const ff = f * Math.pow(2, det / 12);
        for (let h = 1; h <= 5; h++) v += Math.sin(2 * Math.PI * ff * h * t + h * k) / (h * h);
      }
      const trem = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.2 * t + k);
      v *= (gain * env * trem) / 3;
      add(i, v * (1 - pan), v * (1 + pan), v * 0.9);
    }
  });
}

// ---- Arp pluck: triangle with fast decay, ping-pong delay ---------------------------------------
function pluck(t0, m, gain, pan) {
  const f = mtof(m);
  const dec = 0.35;
  const i0 = Math.floor(t0 * SR);
  const n = Math.floor(dec * 4 * SR);
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    const ph = (f * t) % 1;
    const tri = 4 * Math.abs(ph - 0.5) - 1;
    const v = tri * Math.exp(-t / dec) * Math.min(1, t * 400) * gain;
    add(i0 + j, v * (1 - pan), v * (1 + pan), v * 0.6);
  }
}

// ---- Bass: sine + soft saturation ----------------------------------------------------------------
function bass(t0, m, len, gain) {
  const f = mtof(m);
  const i0 = Math.floor(t0 * SR);
  const n = Math.floor(len * SR);
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    const env = Math.min(1, t * 200) * Math.min(1, (len - t) * 30) * Math.exp(-t * 1.5);
    const v = Math.tanh(1.6 * Math.sin(2 * Math.PI * f * t)) * env * gain;
    add(i0 + j, v, v);
  }
}

// ---- Drums ---------------------------------------------------------------------------------------
const kickTimes = [];
function kick(t0, gain) {
  kickTimes.push(t0);
  const i0 = Math.floor(t0 * SR);
  const n = Math.floor(0.45 * SR);
  let ph = 0;
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    const f = 45 + 110 * Math.exp(-t * 28);
    ph += (2 * Math.PI * f) / SR;
    const v = Math.sin(ph) * Math.exp(-t * 7) * gain + (j < 60 ? rand() * 0.15 * gain : 0);
    add(i0 + j, v, v);
  }
}
function hat(t0, gain, pan) {
  const i0 = Math.floor(t0 * SR);
  const n = Math.floor(0.06 * SR);
  let prev = 0;
  for (let j = 0; j < n; j++) {
    const x = rand();
    const hp = x - prev;
    prev = x;
    const v = hp * Math.exp(-(j / SR) * 70) * gain;
    add(i0 + j, v * (1 - pan), v * (1 + pan));
  }
}
function clap(t0, gain) {
  const i0 = Math.floor(t0 * SR);
  const n = Math.floor(0.25 * SR);
  let lp = 0;
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    const burst = t < 0.03 ? 0.6 + 0.4 * Math.sin(t * 2 * Math.PI * 100) : 1;
    lp += 0.45 * (rand() - lp);
    const v = (rand() - lp) * Math.exp(-t * 18) * burst * gain;
    add(i0 + j, v, v, v * 0.8);
  }
}

// ---- FX: riser into the drop, impact on the logo -------------------------------------------------
function riser(t0, len, gain) {
  const i0 = Math.floor(t0 * SR);
  const n = Math.floor(len * SR);
  let lp = 0;
  for (let j = 0; j < n; j++) {
    const p = j / n;
    const a = 0.02 + 0.5 * p * p;
    lp += a * (rand() - lp);
    const v = lp * p * p * gain;
    const pan = Math.sin(p * 18) * 0.5;
    add(i0 + j, v * (1 - pan), v * (1 + pan), v);
  }
}
function impact(t0, gain) {
  const i0 = Math.floor(t0 * SR);
  const n = Math.floor(2.5 * SR);
  let ph = 0;
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    const f = 38 + 60 * Math.exp(-t * 6);
    ph += (2 * Math.PI * f) / SR;
    const v = Math.sin(ph) * Math.exp(-t * 1.8) * gain + rand() * Math.exp(-t * 12) * gain * 0.25;
    add(i0 + j, v, v, v * 0.5);
  }
}

// ---- Arrangement ---------------------------------------------------------------------------------
for (let b = 0; b < BARS; b += 2) {
  const c = chordAt(b);
  const last = b >= 30;
  pad(b, last ? 2 : 2, c.pad, b < 6 ? 0.055 : 0.045);
  if (b >= 6 && b < 30) pad(b, 2, [c.pad[0] - 12], 0.035); // low body from the reveal on
}
pad(30, 2.0, [57, 60, 64, 69, 72], 0.05); // final Am, rings out

const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
for (let b = 0; b < BARS; b++) {
  const c = chordAt(b);
  const tb = b * BAR;
  // sparse arp in the intro, full 8ths from the drop
  if (b >= 3 && b < 8) {
    for (let s = 0; s < 8; s += 2) pluck(tb + s * (BEAT / 2), c.pad[ARP[s]] + 12, 0.05, 0.3);
  } else if (b >= 8 && b < 30) {
    for (let s = 0; s < 8; s++) {
      const t = tb + s * (BEAT / 2);
      const m = c.pad[ARP[s]] + 12;
      pluck(t, m, 0.07, -0.3);
      pluck(t + BEAT * 0.75, m, 0.025, 0.5); // dotted-8th echo
      pluck(t + BEAT * 1.5, m, 0.012, -0.5);
    }
  }
  if (b >= 8 && b < 30) {
    for (let s = 0; s < 8; s++) bass(tb + s * (BEAT / 2), c.root, BEAT / 2 - 0.01, s % 2 ? 0.13 : 0.18);
    for (let q = 0; q < 4; q++) kick(tb + q * BEAT, 0.62);
  }
  if (b >= 12 && b < 30) {
    for (let q = 0; q < 4; q++) {
      hat(tb + q * BEAT + BEAT / 2, 0.11, 0.25);
      hat(tb + q * BEAT + BEAT * 0.75, 0.04, -0.25);
    }
    clap(tb + BEAT, 0.16);
    clap(tb + BEAT * 3, 0.16);
  }
}
impact(6 * BAR, 0.55);
riser(7 * BAR, BAR, 0.35);
impact(29 * BAR, 0.4); // the close
kick(29 * BAR, 0.6);

// ---- Sidechain pad/arp against the kick ----------------------------------------------------------
const duck = new Float32Array(N).fill(1);
for (const t0 of kickTimes) {
  const i0 = Math.floor(t0 * SR);
  const n = Math.floor(BEAT * SR);
  for (let j = 0; j < n && i0 + j < N; j++) {
    const t = j / SR;
    duck[i0 + j] = Math.min(duck[i0 + j], 1 - 0.35 * Math.exp(-t * 9));
  }
}

// ---- Reverb: Schroeder (4 combs + 2 allpasses) on the send ---------------------------------------
function reverb(input) {
  const out = new Float32Array(N);
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ buf: new Float32Array(d), i: 0, lp: 0 }));
  for (let n = 0; n < N; n++) {
    let s = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.lp = y * 0.6 + c.lp * 0.4;
      c.buf[c.i] = input[n] + c.lp * 0.84;
      c.i = (c.i + 1) % c.buf.length;
      s += y;
    }
    out[n] = s / 4;
  }
  for (const d of [225, 556]) {
    const buf = new Float32Array(d);
    let i = 0;
    for (let n = 0; n < N; n++) {
      const b = buf[i];
      const y = -out[n] + b;
      buf[i] = out[n] + b * 0.5;
      i = (i + 1) % d;
      out[n] = y;
    }
  }
  return out;
}
const wet = reverb(send);
const PRE = Math.floor(0.011 * SR);

// ---- Master: mix, soft clip, normalize, fades ----------------------------------------------------
let peak = 0;
for (let i = 0; i < N; i++) {
  const w = wet[i] * 0.55;
  const wr = i >= PRE ? wet[i - PRE] * 0.55 : 0;
  L[i] = Math.tanh((L[i] * duck[i] + w) * 1.1);
  R[i] = Math.tanh((R[i] * duck[i] + wr) * 1.1);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / peak; // about -1 dBFS
const fadeIn = 0.5 * SR;
const fadeOut = 2.5 * SR;
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  let g = norm;
  if (i < fadeIn) g *= i / fadeIn;
  if (i > N - fadeOut) g *= Math.max(0, (N - i) / fadeOut);
  const l = Math.max(-1, Math.min(1, L[i] * g));
  const r = Math.max(-1, Math.min(1, R[i] * g));
  buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
}
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "music.wav");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, buf);
console.log(`wrote ${out} (${DUR.toFixed(1)} s, peak before norm ${peak.toFixed(3)})`);
