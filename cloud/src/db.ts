import type { Checkin, Member, PastSession, Plan, Rating, Sore, Timing } from "./plan";
import { SORE_AREAS } from "./plan";

export interface Env {
  DB: D1Database;
  AI: Ai;
  ASSETS: Fetcher;
}

export const now = () => Date.now();
export const rid = (n = 10) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");
// Join codes avoid look-alike letters so they can be read off a TV across the room.
export const joinCode = () => [...crypto.getRandomValues(new Uint8Array(4))].map((b) => "ACDEFHJKMNPRTUVWXY"[b % 18]).join("");

export function localParts(tz: string, at = now()) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(new Date(at));
  const hour = Number(f.find((p) => p.type === "hour")!.value);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(f.find((p) => p.type === "weekday")!.value);
  return { hour, weekday };
}

export interface Household { id: string; name: string; tz: string; created_at: number }

export async function household(env: Env, hid: string) {
  return env.DB.prepare("SELECT * FROM households WHERE id = ?").bind(hid).first<Household>();
}

export async function members(env: Env, hid: string): Promise<Member[]> {
  const r = await env.DB.prepare("SELECT id, name, color, level, low_impact FROM members WHERE hid = ? ORDER BY pos").bind(hid).all<Member>();
  return r.results;
}

export interface SessionRow {
  id: string; hid: string; code: string; status: string; plan: string | null; coach: string | null;
  started_at: number | null; paused_at: number | null; paused_ms: number; offset_ms: number; pace: number;
  planned_blocks: number; completed_blocks: number; focus: string | null; weekday: number | null; local_hour: number | null;
  summary: string | null; created_at: number; finished_at: number | null; ended_at: number | null; skipped: string | null;
}

export async function sessionByCode(env: Env, code: string) {
  if (!/^[A-Za-z]{4}$/.test(code)) return null;
  return env.DB.prepare("SELECT * FROM sessions WHERE code = ? ORDER BY created_at DESC LIMIT 1").bind(code.toUpperCase()).first<SessionRow>();
}

export interface PresenceRow { member_id: string; present: number; via: string; energy: number | null; sore: string; rating: string | null; updated_at: number }

export async function presence(env: Env, sid: string): Promise<PresenceRow[]> {
  return (await env.DB.prepare("SELECT member_id, present, via, energy, sore, rating, updated_at FROM presence WHERE session_id = ?").bind(sid).all<PresenceRow>()).results;
}

export function checkinsOf(rows: PresenceRow[]): Checkin[] {
  return rows.filter((r) => r.present && r.energy != null).map((r) => ({ member_id: r.member_id, energy: r.energy!, sore: parseSore(r.sore) }));
}

export function parseSore(s: unknown): Sore[] {
  let arr: unknown = s;
  if (typeof s === "string") try { arr = JSON.parse(s); } catch { arr = []; }
  return Array.isArray(arr) ? [...new Set(arr.filter((x): x is Sore => SORE_AREAS.includes(x as Sore)))] : [];
}

export async function history(env: Env, hid: string, limit = 20): Promise<PastSession[]> {
  const r = await env.DB.prepare(
    "SELECT started_at, planned_blocks, completed_blocks, weekday, local_hour, focus FROM sessions WHERE hid = ? AND status = 'done' AND started_at IS NOT NULL ORDER BY started_at DESC LIMIT ?",
  ).bind(hid, limit).all<PastSession>();
  return r.results.reverse();
}

// The last ratings each member gave, oldest first.
export async function pastRatings(env: Env, hid: string): Promise<Record<string, Rating[]>> {
  const r = await env.DB.prepare(
    `SELECT p.member_id, p.rating FROM presence p JOIN sessions s ON s.id = p.session_id
     WHERE s.hid = ? AND s.status = 'done' AND p.rating IS NOT NULL ORDER BY s.started_at`,
  ).bind(hid).all<{ member_id: string; rating: Rating }>();
  const out: Record<string, Rating[]> = {};
  for (const row of r.results) (out[row.member_id] ??= []).push(row.rating);
  return out;
}

export async function events(env: Env, hid: string, limit = 8) {
  return (await env.DB.prepare("SELECT at, text FROM events WHERE hid = ? ORDER BY at DESC LIMIT ?").bind(hid, limit).all<{ at: number; text: string }>()).results;
}

export const timingOf = (s: SessionRow): Timing => ({ started_at: s.started_at, paused_at: s.paused_at, paused_ms: s.paused_ms, offset_ms: s.offset_ms, ended_at: s.ended_at, skipped: JSON.parse(s.skipped ?? "[]") });
export const planOf = (s: SessionRow): Plan | null => (s.plan ? JSON.parse(s.plan) : null);
