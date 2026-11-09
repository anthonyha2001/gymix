// A small synthesiser for episode soundtracks: the episode lists cues in
// window.AUDIO and this turns them into a 44.1 kHz stereo WAV.
// Cues (times in seconds, notes as MIDI numbers):
//   { k: "pad", at, dur, notes: [57, 60, 64], gain }   soft sustained chord
//   { k: "pluck", at, note, gain }                       marimba-like note
//   { k: "bell", at, note, gain }                        bright bell / chime
//   { k: "sub", at, dur, note, gain }                    low drone
//   { k: "whoosh", at, dur, gain, down }                 air sweep for transitions
//   { k: "thump", at, gain }                             soft impact / heartbeat
//   { k: "buzz", at, gain }                              "not allowed" error tone
//   { k: "ice", at, dur, gain }                          freezing crackle + glints
//   { k: "stamp", at, gain }                             a rubber stamp hit
const SR = 44100;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Deterministic noise, so a render always sounds the same.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
}

export function synthWav(cues, duration) {
  const n = Math.ceil((duration + 0.5) * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const add = (i, v, pan = 0) => {
    if (i < 0 || i >= n) return;
    L[i] += v * (1 - Math.max(0, pan));
    R[i] += v * (1 + Math.min(0, pan));
  };
  let seed = 1;

  for (const c of cues) {
    const start = Math.floor(c.at * SR);
    const g = c.gain ?? 1;
    const noise = rng(seed++ * 7919);
    switch (c.k) {
      case "pad": {
        const len = Math.floor(c.dur * SR);
        const atk = Math.min(0.9, c.dur / 3) * SR;
        const rel = Math.min(1.4, c.dur / 2) * SR;
        c.notes.forEach((m, j) => {
          const f = mtof(m);
          for (let i = 0; i < len + rel; i++) {
            const t = i / SR;
            const env = Math.min(1, i / atk) * (i > len ? Math.max(0, 1 - (i - len) / rel) : 1);
            const trem = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.25 * t + j);
            const v = Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.0018 * t) * 0.8 + Math.sin(2 * Math.PI * f * 0.9983 * t) * 0.8 + Math.sin(2 * Math.PI * f * 2 * t) * 0.12;
            add(start + i, v * env * trem * 0.035 * g, (j - (c.notes.length - 1) / 2) * 0.3);
          }
        });
        break;
      }
      case "pluck": {
        const f = mtof(c.note);
        for (let i = 0; i < SR * 1.6; i++) {
          const t = i / SR;
          const v = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 5) + 0.35 * Math.sin(2 * Math.PI * f * 4 * t) * Math.exp(-t * 16) + 0.15 * Math.sin(2 * Math.PI * f * 10 * t) * Math.exp(-t * 40);
          add(start + i, v * Math.min(1, i / 60) * 0.16 * g, ((c.note % 7) - 3) * 0.08);
        }
        break;
      }
      case "bell": {
        const f = mtof(c.note);
        for (let i = 0; i < SR * 2.2; i++) {
          const t = i / SR;
          const v = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 2.2) + 0.5 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 4) + 0.25 * Math.sin(2 * Math.PI * f * 5.4 * t) * Math.exp(-t * 7);
          add(start + i, v * Math.min(1, i / 40) * 0.12 * g);
        }
        break;
      }
      case "sub": {
        const f = mtof(c.note);
        const len = Math.floor(c.dur * SR);
        for (let i = 0; i < len; i++) {
          const t = i / SR;
          const env = Math.min(1, i / (0.6 * SR)) * Math.min(1, (len - i) / (0.6 * SR));
          add(start + i, (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2 * t)) * env * 0.11 * g);
        }
        break;
      }
      case "whoosh": {
        const len = Math.floor(c.dur * SR);
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const x = i / len;
          const env = Math.sin(Math.PI * x) ** 2;
          const cut = c.down ? 0.02 + 0.25 * (1 - x) : 0.02 + 0.25 * x;
          lp += cut * (noise() - lp);
          add(start + i, lp * env * 0.9 * g, (x - 0.5) * 0.8);
        }
        break;
      }
      case "thump": {
        for (let i = 0; i < SR * 0.45; i++) {
          const t = i / SR;
          const f = 45 + 90 * Math.exp(-t * 18);
          add(start + i, Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 9) * 0.5 * g);
        }
        break;
      }
      case "buzz": {
        let lp = 0;
        for (let i = 0; i < SR * 0.55; i++) {
          const t = i / SR;
          const sq = Math.sign(Math.sin(2 * Math.PI * 98 * t)) * 0.6 + Math.sign(Math.sin(2 * Math.PI * 147 * t)) * 0.4;
          lp += 0.08 * (sq - lp);
          const env = Math.min(1, i / 200) * (t < 0.22 || t > 0.28 ? 1 : 0.2) * Math.exp(-t * 2.5);
          add(start + i, lp * env * 0.28 * g);
        }
        break;
      }
      case "ice": {
        const len = Math.floor(c.dur * SR);
        let hp = 0, prev = 0;
        for (let i = 0; i < len; i++) {
          const x = i / len;
          const crack = noise() > 0.995 - 0.004 * x ? noise() : 0;
          const v = noise() * 0.04 * (1 - x) + crack;
          hp = 0.85 * (hp + v - prev);
          prev = v;
          add(start + i, hp * 0.5 * g, noise() * 0.6);
        }
        for (let k = 0; k < 14; k++) {
          const at = start + Math.floor(((k + 0.5) / 14) * len * 0.9);
          const f = 2200 + ((k * 677) % 2600);
          for (let i = 0; i < SR * 0.35; i++) {
            const t = i / SR;
            add(at + i, Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 14) * 0.05 * g, ((k % 5) - 2) * 0.3);
          }
        }
        break;
      }
      case "stamp": {
        for (let i = 0; i < SR * 0.3; i++) {
          const t = i / SR;
          add(start + i, (Math.sin(2 * Math.PI * (80 + 200 * Math.exp(-t * 40)) * t) * 0.6 + noise() * 0.5 * Math.exp(-t * 60)) * Math.exp(-t * 14) * 0.55 * g);
        }
        break;
      }
    }
  }

  // A light room: a few feedback delays mixed under the dry sound.
  const combs = [1116, 1188, 1277, 1356].map((d) => ({ d, buf: new Float32Array(d), i: 0 }));
  for (const [ch, pan] of [[L, 0], [R, 23]]) {
    const out = new Float32Array(n);
    for (const c of combs) {
      c.buf.fill(0);
      c.i = 0;
      const d = c.d + pan;
      const buf = new Float32Array(d);
      let idx = 0, lp = 0;
      for (let i = 0; i < n; i++) {
        const y = buf[idx];
        lp = y * 0.6 + lp * 0.4;
        buf[idx] = ch[i] + lp * 0.78;
        out[i] += y * 0.06;
        idx = (idx + 1) % d;
      }
    }
    for (let i = 0; i < n; i++) ch[i] += out[i];
  }

  // Master: soft clip, normalise to -1 dBFS, fade the last half second.
  let peak = 1e-9;
  for (let i = 0; i < n; i++) {
    L[i] = Math.tanh(L[i] * 1.2);
    R[i] = Math.tanh(R[i] * 1.2);
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const norm = 0.89 / peak;
  const fade = Math.floor(0.5 * SR);
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const f = i > n - fade ? (n - i) / fade : 1;
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm * f)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm * f)) * 32767), 46 + i * 4);
  }
  return buf;
}
