const VOLUME_KEY = 'dinoLearn_volume';
const MUTE_KEY = 'dinoLearn_muted';

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let userVolume = loadVolume();
let isMuted = loadMuted();

function loadVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw !== null) return Math.max(0, Math.min(1, parseFloat(raw)));
  } catch {}
  return 0.5;
}

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {}
  return false;
}

function applyVolume() {
  if (masterGain) {
    const effective = isMuted ? 0 : userVolume * 0.6;
    masterGain.gain.setValueAtTime(effective, audioCtx!.currentTime);
  }
}

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    applyVolume();
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function getMaster(): GainNode {
  getCtx();
  return masterGain!;
}

export function initAudio() {
  getCtx();
}

export function getVolume(): number {
  return userVolume;
}

export function setVolume(v: number) {
  userVolume = Math.max(0, Math.min(1, v));
  try { localStorage.setItem(VOLUME_KEY, String(userVolume)); } catch {}
  applyVolume();
}

export function getMuted(): boolean {
  return isMuted;
}

export function setMuted(m: boolean) {
  isMuted = m;
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch {}
  applyVolume();
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(getMaster());
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export function playPop() {
  playTone(600, 0.15, 'sine', 0.2);
  setTimeout(() => playTone(900, 0.1, 'sine', 0.15), 50);
}

export function playHatch() {
  playTone(400, 0.1, 'triangle');
  setTimeout(() => playTone(600, 0.1, 'triangle'), 100);
  setTimeout(() => playTone(800, 0.2, 'triangle'), 200);
}

export function playSuccess() {
  playTone(523, 0.15, 'triangle', 0.2);
  setTimeout(() => playTone(659, 0.15, 'triangle', 0.2), 150);
  setTimeout(() => playTone(784, 0.3, 'triangle', 0.2), 300);
}

export function playKeyPress() {
  playTone(440 + Math.random() * 200, 0.1, 'square', 0.08);
}

export function playWrongKey() {
  playTone(200, 0.2, 'sawtooth', 0.06);
}

export function playStep() {
  playTone(250 + Math.random() * 100, 0.08, 'triangle', 0.1);
}

export function playCelebration() {
  const notes = [523, 587, 659, 784, 880];
  notes.forEach((n, i) => {
    setTimeout(() => playTone(n, 0.15, 'triangle', 0.15), i * 100);
  });
}

export function playSticker() {
  playTone(880, 0.1, 'sine', 0.2);
  setTimeout(() => playTone(1100, 0.15, 'sine', 0.2), 100);
  setTimeout(() => playTone(1320, 0.2, 'sine', 0.2), 200);
}

export function playFlip() {
  playTone(500, 0.08, 'triangle', 0.12);
  setTimeout(() => playTone(700, 0.06, 'triangle', 0.08), 40);
}

export function playMatch() {
  playTone(660, 0.12, 'sine', 0.18);
  setTimeout(() => playTone(880, 0.12, 'sine', 0.18), 100);
  setTimeout(() => playTone(1100, 0.18, 'sine', 0.15), 200);
}

export function playMismatch() {
  playTone(300, 0.15, 'sawtooth', 0.06);
  setTimeout(() => playTone(250, 0.2, 'sawtooth', 0.05), 120);
}
