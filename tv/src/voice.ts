// The coach's voice, played through Vega's W3C media stack (AudioPlayer). Lines are spoken one
// at a time. A new cue replaces anything still waiting, so the coach never falls behind the
// timer; the introduction is queued sentence by sentence. Audio comes from the service's
// /api/tts (Deepgram Aura-2, cached per sentence).
import {AudioPlayer} from '@amazon-devices/react-native-w3cmedia';
import {BASE} from './api';

let player: AudioPlayer | null = null;
let ready: Promise<void> | null = null;
let busy = false;
let queue: string[] = [];
const listeners = new Set<(line: string | null) => void>();
const saidListeners = new Set<(line: string) => void>();
let current: string | null = null;
let reported = false; // whether the current line was already reported as said

// Report the line once: when it starts playing, or when the audio fails (the free daily voice
// allowance can run out), so phones still get the caption.
function report() {
  if (current && !reported) {
    reported = true;
    saidListeners.forEach(l => l(current!));
  }
}

// The service only voices lines for an open room, so every request carries the room code.
let room = '';
export const setRoom = (code: string | null) => {
  room = code ?? '';
};
export const ttsUrl = (text: string) => `${BASE}/api/tts?s=${room}&t=${encodeURIComponent(text)}`;

function init() {
  if (!ready) {
    player = new AudioPlayer();
    ready = player.initialize().then(() => {
      player!.addEventListener('ended', next);
      player!.addEventListener('error', () => {
        report();
        next();
      });
      // Report the moment a line is actually heard (phones show it as a caption).
      player!.addEventListener('playing', report);
    });
  }
  return ready;
}

function emit(line: string | null) {
  listeners.forEach(l => l(line));
}

async function next() {
  busy = false;
  const line = queue.shift();
  emit(null);
  if (line) await play(line);
}

// A cue: replaces whatever is still waiting.
export async function say(text: string) {
  if (!text) return;
  if (busy) {
    queue = [text];
    return;
  }
  await play(text);
}

// Several lines in order (the introduction): fetch them all ahead, then play one after another.
export async function sayAll(lines: string[]) {
  if (!lines.length) return;
  prefetch(lines.slice(1));
  if (busy) {
    queue = [...lines];
    return;
  }
  queue = lines.slice(1);
  await play(lines[0]);
}

async function play(text: string) {
  busy = true;
  current = text;
  reported = false;
  emit(text);
  try {
    await init();
    player!.src = ttsUrl(text);
    await player!.play();
  } catch {
    report();
    busy = false;
    emit(null);
  }
}

export function stop() {
  queue = [];
  try {
    player?.pause();
  } catch {
    // Nothing was playing.
  }
  busy = false;
  emit(null);
}

// Warm the server cache so the first time a cue plays it starts right away.
export function prefetch(lines: string[]) {
  for (const l of [...new Set(lines)]) fetch(ttsUrl(l)).catch(() => {});
}

export function onSaid(fn: (line: string) => void) {
  saidListeners.add(fn);
  return () => {
    saidListeners.delete(fn);
  };
}

export function onLine(fn: (line: string | null) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
