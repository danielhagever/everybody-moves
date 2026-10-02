import { speech } from "./tts";
import * as db from "./db";
import type { Env, SessionRow } from "./db";
import { adapt, blockStart, buildPlan, completedWork, pickMinutes, position, SORE_AREAS } from "./plan";
import type { Member, Plan, Rating } from "./plan";
import { coachIntro, sentences } from "./coach";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "access-control-allow-origin": "*" },
  });
const bad = (msg: string, status = 400) => json({ error: msg }, status);

// A simple per-address, per-hour counter kept in the edge cache (approximate, which is enough to
// stop a runaway script from filling the free database).
async function allow(req: Request, what: string, perHour: number): Promise<boolean> {
  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  const key = new Request(`https://limits.cache/${what}/${ip}/${Math.floor(Date.now() / 3_600_000)}`);
  const cache = (caches as any).default as Cache;
  const n = Number((await (await cache.match(key))?.text()) ?? 0);
  if (n >= perHour) return false;
  await cache.put(key, new Response(String(n + 1), { headers: { "cache-control": "max-age=3600" } }));
  return true;
}

async function body(req: Request): Promise<Record<string, any>> {
  try { return (await req.json()) as Record<string, any>; } catch { return {}; }
}

// A sample household, so anyone can try the app in one click. It lives wherever it is early
// evening right now (when families actually work out) and comes with two weeks of history,
// so the planner has patterns to adapt to.
const CITIES = [
  { city: "New York", tz: "America/New_York" }, { city: "Chicago", tz: "America/Chicago" }, { city: "Denver", tz: "America/Denver" },
  { city: "Los Angeles", tz: "America/Los_Angeles" }, { city: "Honolulu", tz: "Pacific/Honolulu" }, { city: "London", tz: "Europe/London" },
  { city: "Berlin", tz: "Europe/Berlin" }, { city: "Dubai", tz: "Asia/Dubai" }, { city: "Singapore", tz: "Asia/Singapore" },
  { city: "Sydney", tz: "Australia/Sydney" }, { city: "Auckland", tz: "Pacific/Auckland" },
];

const SAMPLE = [
  { name: "Maya", color: "#FF8A3D", level: 2, low_impact: 0 },
  { name: "Ben", color: "#4CC9F0", level: 2, low_impact: 0 },
  { name: "Lily", color: "#B5E48C", level: 2, low_impact: 0 },
  { name: "Grandpa Joe", color: "#F7B2D9", level: 1, low_impact: 1 },
];

async function seed(env: Env) {
  const hour = (tz: string) => db.localParts(tz).hour;
  const home = [...CITIES].sort((a, b) => Math.abs(hour(a.tz) - 18.5) - Math.abs(hour(b.tz) - 18.5))[0];
  const hid = db.rid();
  const t = db.now();
  const stmts: D1PreparedStatement[] = [
    env.DB.prepare("INSERT INTO households (id, name, tz, created_at) VALUES (?, ?, ?, ?)").bind(hid, "The Parker household", home.tz, t),
  ];
  const ids = SAMPLE.map(() => db.rid());
  SAMPLE.forEach((m, i) => stmts.push(env.DB.prepare("INSERT INTO members (id, hid, name, color, level, low_impact, pos) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(ids[i], hid, m.name, m.color, m.level, m.low_impact, i)));
  // Two weeks of sessions. The three most recent evening sessions were cut short (9 planned
  // blocks, 5 or 6 done), and Lily rated her last session "easy".
  const DAY = 86_400_000;
  const past = [
    { ago: 13, focus: "legs", planned: 9, done: 9, ratings: ["right", "right", "right", "right"] },
    { ago: 11, focus: "upper", planned: 9, done: 9, ratings: ["hard", "right", "right", "right"] },
    { ago: 8, focus: "core", planned: 9, done: 6, ratings: ["right", "right", "right", "right"] },
    { ago: 6, focus: "legs", planned: 9, done: 5, ratings: ["right", "right", "right", "right"] },
    { ago: 2, focus: "upper", planned: 9, done: 6, ratings: ["right", "right", "easy", "right"] },
  ];
  for (const p of past) {
    const sid = db.rid();
    const at = t - p.ago * DAY - 15 * 60_000;
    const lp = db.localParts(home.tz, at);
    stmts.push(env.DB.prepare(
      "INSERT INTO sessions (id, hid, code, status, started_at, planned_blocks, completed_blocks, focus, weekday, local_hour, created_at, finished_at) VALUES (?, ?, ?, 'done', ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(sid, hid, "0000", at, p.planned, p.done, p.focus, lp.weekday, lp.hour, at, at + p.done * 60_000)); // "0000" can't be addressed as a room
    ids.forEach((mid, i) => stmts.push(env.DB.prepare("INSERT INTO presence (session_id, member_id, present, via, energy, sore, rating, updated_at) VALUES (?, ?, 1, 'tv', 3, '[]', ?, ?)").bind(sid, mid, p.ratings[i], at)));
  }
  const lastDay = new Intl.DateTimeFormat("en-US", { timeZone: home.tz, weekday: "long" }).format(new Date(t - 2 * DAY));
  stmts.push(env.DB.prepare("INSERT INTO events (hid, at, text) VALUES (?, ?, ?)").bind(hid, t - 2 * DAY, `Lily rated ${lastDay}'s session "easy".`));
  await env.DB.batch(stmts);
  return { hid, city: home.city };
}

async function householdView(env: Env, hid: string) {
  const h = await db.household(env, hid);
  if (!h) return null;
  const [ms, hist, ev] = await Promise.all([db.members(env, hid), db.history(env, hid), db.events(env, hid)]);
  const DAY = 86_400_000;
  const days = new Set(hist.map((s) => Math.floor((s.started_at - hist[0]?.started_at) / DAY)));
  const thisWeek = hist.filter((s) => db.now() - s.started_at < 7 * DAY).length;
  // The last 7 days in the household's own time zone, oldest first.
  const dayOf = (at: number) => new Intl.DateTimeFormat("en-CA", { timeZone: h.tz }).format(new Date(at));
  const label = (at: number) => new Intl.DateTimeFormat("en-US", { timeZone: h.tz, weekday: "narrow" }).format(new Date(at));
  const done = new Set(hist.map((s) => dayOf(s.started_at)));
  const week = Array.from({ length: 7 }, (_, i) => { const at = db.now() - (6 - i) * DAY; return { label: label(at), done: done.has(dayOf(at)), today: i === 6 }; });
  return { household: h, members: ms, sessions_total: hist.length, sessions_this_week: thisWeek, active_days: days.size, events: ev, recent: hist.slice(-7), week };
}

async function sessionView(env: Env, s: SessionRow) {
  const [ms, pr, line] = await Promise.all([
    db.members(env, s.hid),
    db.presence(env, s.id),
    env.DB.prepare("SELECT at, text FROM lines WHERE session_id = ? ORDER BY at DESC LIMIT 1").bind(s.id).first<{ at: number; text: string }>(),
  ]);
  const plan = db.planOf(s);
  const t = db.now();
  const pos = plan && s.status === "live" ? position(plan, db.timingOf(s), t) : null;
  return {
    code: s.code, status: s.status, server_now: t, pace: s.pace,
    members: ms,
    presence: pr.map((p) => ({ ...p, sore: db.parseSore(p.sore) })),
    plan, coach: s.coach ? JSON.parse(s.coach) : null,
    timing: db.timingOf(s), position: pos,
    summary: s.summary ? JSON.parse(s.summary) : null,
    caption: line && t - line.at < 8000 ? line : null,
  };
}

async function upsertPresence(env: Env, sid: string, mid: string, fields: { present?: number; via?: string; energy?: number | null; sore?: string[]; rating?: string | null }) {
  const cur = await env.DB.prepare("SELECT * FROM presence WHERE session_id = ? AND member_id = ?").bind(sid, mid).first<db.PresenceRow>();
  const row = {
    present: fields.present ?? cur?.present ?? 1,
    via: fields.via ?? cur?.via ?? "tv",
    energy: fields.energy !== undefined ? fields.energy : cur?.energy ?? null,
    sore: JSON.stringify(fields.sore ?? db.parseSore(cur?.sore ?? "[]")),
    rating: fields.rating !== undefined ? fields.rating : cur?.rating ?? null,
  };
  await env.DB.prepare(
    `INSERT INTO presence (session_id, member_id, present, via, energy, sore, rating, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (session_id, member_id) DO UPDATE SET present = excluded.present, via = excluded.via, energy = excluded.energy, sore = excluded.sore, rating = excluded.rating, updated_at = excluded.updated_at`,
  ).bind(sid, mid, row.present, row.via, row.energy, row.sore, row.rating, db.now()).run();
}

async function makePlan(env: Env, s: SessionRow, pace: number) {
  const h = (await db.household(env, s.hid))!;
  const [all, pr, hist] = await Promise.all([db.members(env, s.hid), db.presence(env, s.id), db.history(env, s.hid)]);
  const inRoom = new Set(pr.filter((p) => p.present).map((p) => p.member_id));
  const ms = all.filter((m) => inRoom.has(m.id));
  if (!ms.length) return { error: "Nobody is in the room yet." };
  const lp = db.localParts(h.tz);
  const plan: Plan = buildPlan(ms, db.checkinsOf(pr), hist, lp.hour);
  if (pace !== 1) for (const b of plan.blocks) b.seconds = Math.max(4, Math.round(b.seconds / pace));
  const coach = await coachIntro(env, ms, plan);
  // Make the first sentence's audio now, so the TV starts speaking the moment the plan appears;
  // the TV fetches the rest while that sentence plays. Capped at 6 s.
  await Promise.race([speech(env, sentences(coach.text)[0]).catch(() => null), new Promise((r) => setTimeout(r, 6_000))]);
  await env.DB.prepare("UPDATE sessions SET status = 'ready', plan = ?, coach = ?, pace = ?, planned_blocks = ?, focus = ?, weekday = ?, local_hour = ? WHERE id = ?")
    .bind(JSON.stringify(plan), JSON.stringify(coach), pace, plan.blocks.filter((b) => b.kind === "work").length, plan.focus_key, lp.weekday, lp.hour, s.id).run();
  return { ok: true };
}

async function control(env: Env, s: SessionRow, action: string) {
  const plan = db.planOf(s);
  if (!plan) return bad("Make a plan first.");
  const t = db.now();
  if (s.ended_at || s.status === "done") return bad("This session has ended.");
  if (action === "start") {
    // Only a ready session starts; pressing Start again on a live one changes nothing.
    if (s.status === "ready") await env.DB.prepare("UPDATE sessions SET status = 'live', started_at = ?, paused_at = NULL WHERE id = ?").bind(t, s.id).run();
    else if (s.status !== "live") return bad("Not ready.");
  } else if (action === "pause" && s.status === "live" && !s.paused_at) {
    await env.DB.prepare("UPDATE sessions SET paused_at = ? WHERE id = ?").bind(t, s.id).run();
  } else if (action === "resume" && s.paused_at) {
    await env.DB.prepare("UPDATE sessions SET paused_ms = paused_ms + ?, paused_at = NULL WHERE id = ?").bind(t - s.paused_at, s.id).run();
  } else if ((action === "next" || action === "prev") && s.status === "live") {
    const pos = position(plan, db.timingOf(s), t);
    const target = Math.max(0, Math.min(plan.blocks.length - 1, pos.index + (action === "next" ? 1 : -1)));
    const elapsedNow = ((s.paused_at ?? t) - s.started_at! - s.paused_ms + s.offset_ms);
    const offset = s.offset_ms + blockStart(plan, target) * 1000 - elapsedNow + 1;
    await env.DB.prepare("UPDATE sessions SET offset_ms = ? WHERE id = ?").bind(Math.round(offset), s.id).run();
  } else if (action === "end" && s.status === "live") {
    // Stop the clock for everyone; ratings come next, then finish.
    await env.DB.prepare("UPDATE sessions SET ended_at = ? WHERE id = ?").bind(t, s.id).run();
  }
  return json({ ok: true });
}

async function finish(env: Env, s: SessionRow) {
  const plan = db.planOf(s);
  if (!plan || !s.started_at) return bad("Not started.");
  if (s.status === "done") return json({ ok: true, summary: s.summary ? JSON.parse(s.summary) : null });
  const t = db.now();
  const completed = completedWork(plan, db.timingOf(s), t);
  const [all, pr, prev] = await Promise.all([db.members(env, s.hid), db.presence(env, s.id), db.pastRatings(env, s.hid)]);
  const inRoom = all.filter((m) => pr.some((p) => p.member_id === m.id && p.present));
  const ratings: Record<string, Rating> = {};
  for (const p of pr) if (p.rating === "easy" || p.rating === "right" || p.rating === "hard") ratings[p.member_id] = p.rating;
  const { level, changes } = adapt(inRoom, ratings, prev);
  const minutes = Math.round((((s.paused_at ?? s.ended_at ?? t) - s.started_at - s.paused_ms + s.offset_ms) / 60_000) * s.pace);
  const summary = { completed_blocks: completed, planned_blocks: plan.blocks.filter((b) => b.kind === "work").length, minutes, changes, who: inRoom.map((m) => m.name) };
  const stmts: D1PreparedStatement[] = [
    env.DB.prepare("UPDATE sessions SET status = 'done', completed_blocks = ?, finished_at = ?, summary = ? WHERE id = ?").bind(completed, t, JSON.stringify(summary), s.id),
    ...Object.entries(level).map(([mid, lv]) => env.DB.prepare("UPDATE members SET level = ? WHERE id = ?").bind(lv, mid)),
    env.DB.prepare("INSERT INTO events (hid, at, text) VALUES (?, ?, ?)").bind(s.hid, t, `${summary.who.join(", ")} finished ${completed} of ${summary.planned_blocks} work blocks.`),
    ...changes.map((c, i) => env.DB.prepare("INSERT INTO events (hid, at, text) VALUES (?, ?, ?)").bind(s.hid, t + 1 + i, c[0].toUpperCase() + c.slice(1) + ".")),
  ];
  await env.DB.batch(stmts);
  // What the household's pattern now says about the next session at this time of day.
  const hist = await db.history(env, s.hid);
  const next = pickMinutes(hist, s.local_hour ?? 18, []);
  const full = { ...summary, next: { minutes: next.minutes, reason: next.reason ?? "your recent sessions at this time look steady, so the next one stays at 12 minutes" } };
  await env.DB.prepare("UPDATE sessions SET summary = ? WHERE id = ?").bind(JSON.stringify(full), s.id).run();
  return json({ ok: true, summary: full });
}

async function api(env: Env, req: Request, url: URL): Promise<Response> {
  const p = url.pathname;
  if (req.method === "OPTIONS") return new Response(null, { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET, POST" } });

  if (p === "/api/tts") {
    // The coach's voice uses the shared daily AI allowance, so it only speaks for a real room
    // opened in the last 12 hours.
    const room = await db.sessionByCode(env, url.searchParams.get("s") ?? "");
    if (!room || db.now() - room.created_at > 12 * 3_600_000) return bad("The voice is only available inside a session.", 403);
    return speech(env, url.searchParams.get("t") ?? "");
  }

  if (p === "/api/demo" && req.method === "POST") {
    // Each sample household is about 30 database writes; cap how many one address can make.
    if (!(await allow(req, "demo", 40))) return bad("Too many new households from this address; try again in an hour.", 429);
    return json(await seed(env));
  }

  if (p === "/api/household") {
    const v = await householdView(env, url.searchParams.get("hid") ?? "");
    return v ? json(v) : bad("No such household.", 404);
  }

  if (p === "/api/session/new" && req.method === "POST") {
    const b = await body(req);
    const h = await db.household(env, String(b.hid ?? ""));
    if (!h) return bad("No such household.", 404);
    let code = db.joinCode();
    for (let i = 0; i < 5; i++) {
      const taken = await db.sessionByCode(env, code);
      if (!taken || taken.status === "done") break;
      code = db.joinCode();
    }
    const sid = db.rid();
    await env.DB.prepare("INSERT INTO sessions (id, hid, code, created_at) VALUES (?, ?, ?, ?)").bind(sid, h.id, code, db.now()).run();
    return json({ code, join_url: `${url.origin}/j/${code}` });
  }

  const m = p.match(/^\/api\/session\/([A-Za-z]{4})(?:\/(\w+))?$/);
  if (!m) return bad("Not found.", 404);
  const s = await db.sessionByCode(env, m[1]);
  if (!s) return bad("No session with that code.", 404);
  const action = m[2] ?? "";
  if (!action && req.method === "GET") return json(await sessionView(env, s));
  if (action === "lines" && req.method === "GET")
    return json((await env.DB.prepare("SELECT at, text FROM lines WHERE session_id = ? ORDER BY at").bind(s.id).all()).results);
  if (req.method !== "POST") return bad("Use POST.", 405);
  const b = await body(req);
  const memberOk = async () => (await db.members(env, s.hid)).find((x: Member) => x.id === b.member);

  switch (action) {
    case "present": {
      if (!(await memberOk())) return bad("Unknown member.");
      await upsertPresence(env, s.id, b.member, { present: b.present === false ? 0 : 1, via: b.via === "phone" ? "phone" : undefined });
      return json({ ok: true });
    }
    case "checkin": {
      if (!(await memberOk())) return bad("Unknown member.");
      const energy = Math.round(Number(b.energy));
      if (!(energy >= 1 && energy <= 5)) return bad("Energy is 1 to 5.");
      await upsertPresence(env, s.id, b.member, { present: 1, via: b.via === "phone" ? "phone" : undefined, energy, sore: db.parseSore(b.sore) });
      return json({ ok: true });
    }
    case "plan": {
      if (s.status === "live" || s.status === "done") return bad("Already started.");
      const pace = b.pace === "demo" ? 5 : 1;
      const r = await makePlan(env, s, pace);
      return "error" in r ? bad(r.error!) : json(await sessionView(env, (await db.sessionByCode(env, s.code))!));
    }
    case "control":
      return control(env, s, String(b.action ?? ""));
    case "rate": {
      if (!(await memberOk())) return bad("Unknown member.");
      if (!["easy", "right", "hard"].includes(b.rating)) return bad("Rating is easy, right or hard.");
      await upsertPresence(env, s.id, b.member, { rating: b.rating });
      return json({ ok: true });
    }
    case "finish":
      return finish(env, s);
    case "said": {
      // The TV reports each line the coach starts speaking; phones show it as a caption.
      const text = String(b.text ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
      if (!text) return bad("Nothing said.");
      await env.DB.prepare("INSERT INTO lines (session_id, at, text) VALUES (?, ?, ?)").bind(s.id, db.now(), text).run();
      return json({ ok: true });
    }
  }
  return bad("Not found.", 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith("/api/")) return await api(env, req, url);
      const j = url.pathname.match(/^\/j\/([A-Za-z]{4})\/?$/);
      // Serve the phone page at /j/CODE itself (the asset handler would redirect /phone.html to
      // /phone and the code in the address would be lost).
      if (j) {
        const page = await env.ASSETS.fetch(new Request(new URL("/phone", url.origin)));
        return new Response(page.body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      }
      return env.ASSETS.fetch(req);
    } catch (e: any) {
      console.error("error", e?.stack ?? e);
      return bad("Something went wrong. " + String(e?.message ?? e).slice(0, 200), 500);
    }
  },
} satisfies ExportedHandler<Env>;

export { SORE_AREAS };
