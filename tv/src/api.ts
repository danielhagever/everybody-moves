// Talks to the Everybody Moves service (Cloudflare Worker in ../cloud). The TV and every phone
// in the room read the same session, so the plan and the clock always agree.

export const BASE = 'https://everybody-moves.meshulam791.workers.dev';

export type Sore = 'knees' | 'back' | 'shoulders' | 'wrists';
export type Rating = 'easy' | 'right' | 'hard';

export interface Member {
  id: string;
  name: string;
  color: string;
  level: number;
  low_impact: number;
}

export interface PersonalVariation {
  member_id: string;
  name: string;
  cue: string;
  anim: string;
  why?: string;
}

export interface Block {
  move_id: string;
  move: string;
  kind: 'warmup' | 'work' | 'rest' | 'cooldown';
  seconds: number;
  per_member: PersonalVariation[];
}

export interface Plan {
  minutes: number;
  focus: string;
  blocks: Block[];
  notes: string[];
  member_levels: Record<string, number>;
}

export interface Timing {
  started_at: number | null;
  paused_at: number | null;
  paused_ms: number;
  offset_ms: number;
}

export interface Presence {
  member_id: string;
  present: number;
  via: 'tv' | 'phone';
  energy: number | null;
  sore: Sore[];
  rating: Rating | null;
}

export interface Summary {
  completed_blocks: number;
  planned_blocks: number;
  minutes: number;
  changes: string[];
  who: string[];
}

export interface Session {
  code: string;
  status: 'lobby' | 'ready' | 'live' | 'done';
  server_now: number;
  pace: number;
  members: Member[];
  presence: Presence[];
  plan: Plan | null;
  coach: {text: string; source: 'ai' | 'template'} | null;
  timing: Timing;
  summary: Summary | null;
}

export interface HouseholdView {
  household: {id: string; name: string; tz: string};
  members: Member[];
  sessions_total: number;
  sessions_this_week: number;
  active_days: number;
  events: {at: number; text: string}[];
  recent: {started_at: number; planned_blocks: number; completed_blocks: number; focus: string}[];
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(BASE + path, body === undefined ? undefined : {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
  return j as T;
}

export const api = {
  demo: () => call<{hid: string; city: string}>('/api/demo', {}),
  household: (hid: string) => call<HouseholdView>(`/api/household?hid=${hid}`),
  newSession: (hid: string) => call<{code: string; join_url: string}>('/api/session/new', {hid}),
  session: (code: string) => call<Session>(`/api/session/${code}`),
  present: (code: string, member: string, present: boolean) => call(`/api/session/${code}/present`, {member, present}),
  plan: (code: string, demoPace: boolean) => call<Session>(`/api/session/${code}/plan`, demoPace ? {pace: 'demo'} : {}),
  control: (code: string, action: 'start' | 'pause' | 'resume' | 'next' | 'prev' | 'end') => call(`/api/session/${code}/control`, {action}),
  rate: (code: string, member: string, rating: Rating) => call(`/api/session/${code}/rate`, {member, rating}),
  finish: (code: string) => call<{summary: Summary}>(`/api/session/${code}/finish`, {}),
};

// Same rule as the server and the phones: where the session is, from the shared start time.
export function position(plan: Plan, t: Timing, now: number): {index: number; remaining: number; done: boolean} {
  if (!t.started_at) return {index: 0, remaining: plan.blocks[0]?.seconds ?? 0, done: false};
  let elapsed = ((t.paused_at ?? now) - t.started_at - t.paused_ms + t.offset_ms) / 1000;
  for (let i = 0; i < plan.blocks.length; i++) {
    if (elapsed < plan.blocks[i].seconds) return {index: i, remaining: Math.ceil(plan.blocks[i].seconds - elapsed), done: false};
    elapsed -= plan.blocks[i].seconds;
  }
  return {index: plan.blocks.length - 1, remaining: 0, done: true};
}

export const LEVEL_NAMES = ['', 'Gentle', 'Steady', 'Strong'];
