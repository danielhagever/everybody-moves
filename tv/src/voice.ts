// The coach's voice, played through Vega's W3C media stack (AudioPlayer). Lines are spoken one
// at a time; a newer line replaces anything still waiting so the coach never falls behind the
// timer. Audio comes from the service's /api/tts (Deepgram Aura-2, cached per sentence).
import {AudioPlayer} from '@amazon-devices/react-native-w3cmedia';
import {BASE} from './api';

let player: AudioPlayer | null = null;
let ready: Promise<void> | null = null;
let busy = false;
let pending: string | null = null;
let muted = false;
const listeners = new Set<(line: string | null) => void>();

export const ttsUrl = (text: string) => `${BASE}/api/tts?t=${encodeURIComponent(text)}`;

function init() {
  if (!ready) {
    player = new AudioPlayer();
    ready = player.initialize().then(() => {
      player!.addEventListener('ended', next);
      player!.addEventListener('error', next);
    });
  }
  return ready;
}

function emit(line: string | null) {
  listeners.forEach(l => l(line));
}

async function next() {
  busy = false;
  const line = pending;
  pending = null;
  emit(null);
  if (line) await say(line);
}

export async function say(text: string) {
  if (muted || !text) return;
  if (busy) {
    pending = text;
    return;
  }
  busy = true;
  emit(text);
  try {
    await init();
    player!.src = ttsUrl(text);
    await player!.play();
  } catch {
    busy = false;
    emit(null);
  }
}

export function stop() {
  pending = null;
  try {
    player?.pause();
  } catch {}
  busy = false;
  emit(null);
}

export function setMuted(m: boolean) {
  muted = m;
  if (m) stop();
}

// Warm the server cache so the first time a cue plays it starts right away.
export function prefetch(lines: string[]) {
  for (const l of [...new Set(lines)]) fetch(ttsUrl(l)).catch(() => {});
}

export function onLine(fn: (line: string | null) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
