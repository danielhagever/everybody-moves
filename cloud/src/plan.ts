// The workout planner. Everyone in the room follows the same move at the same time, but each
// person gets their own version of it: their level, today's energy, and anything sore decide
// which variation they see. The plan is computed here, deterministically, so the TV and every
// phone agree on it; the language model only phrases the coach's introduction.

export type Sore = "knees" | "back" | "shoulders" | "wrists";
export const SORE_AREAS: Sore[] = ["knees", "back", "shoulders", "wrists"];

export interface Member {
  id: string;
  name: string;
  color: string;
  level: number; // 1 gentle, 2 steady, 3 strong
  low_impact: number; // 1 = never jump
}

export interface Checkin {
  member_id: string;
  energy: number; // 1..5
  sore: Sore[];
}

export interface PastSession {
  started_at: number;
  planned_blocks: number;
  completed_blocks: number;
  weekday: number;
  local_hour: number;
  focus: string;
}

interface Variation {
  name: string;
  cue: string;
  impact: "low" | "high";
  anim?: string; // when this version looks different from the base move (a wall push-up stands)
}

interface Move {
  id: string;
  name: string;
  focus: "warmup" | "legs" | "upper" | "core" | "cardio" | "cooldown";
  levels: [Variation, Variation, Variation];
  // What to do instead when this area is sore. Must not load that area.
  instead?: Partial<Record<Sore, Variation & { anim: string }>>;
}

const v = (name: string, cue: string, impact: "low" | "high" = "low", anim?: string): Variation => ({ name, cue, impact, ...(anim ? { anim } : {}) });

export const MOVES: Move[] = [
  {
    id: "march", name: "March in place", focus: "warmup",
    levels: [v("Easy march", "Lift your feet, swing your arms"), v("Brisk march", "Knees to hip height, arms pumping"), v("High knees", "Quick feet, knees up high", "high")],
    instead: { knees: { ...v("Seated march", "Sit tall, lift one knee at a time"), anim: "seatedmarch" } },
  },
  {
    id: "circles", name: "Arm circles", focus: "warmup",
    levels: [v("Small arm circles", "Arms out, small circles"), v("Big arm circles", "Big slow circles, both ways"), v("Arm circles + reach", "Big circles, then reach up high")],
    instead: { shoulders: { ...v("Shoulder rolls", "Roll your shoulders back, slowly"), anim: "circles" } },
  },
  {
    id: "squat", name: "Squats", focus: "legs",
    levels: [v("Chair squat", "Sit down to a chair and stand back up"), v("Bodyweight squat", "Hips back, chest up, push through your heels"), v("Jump squat", "Squat, then jump softly", "high")],
    instead: { knees: { ...v("Glute bridge", "On your back, lift your hips, squeeze"), anim: "bridge" }, back: { ...v("Chair squat", "Sit down to a chair, stand up tall"), anim: "squat" } },
  },
  {
    id: "pushup", name: "Push-ups", focus: "upper",
    levels: [v("Wall push-up", "Hands on the wall, lower your chest", "low", "wallpush"), v("Knee push-up", "Knees down, straight line from head to knees", "low", "kneepush"), v("Push-up", "Full push-up, body straight")],
    instead: { shoulders: { ...v("Dead bug", "On your back, slowly lower opposite arm and leg"), anim: "deadbug" }, wrists: { ...v("Wall push-up on fists", "Fists on the wall, keep wrists straight"), anim: "wallpush" } },
  },
  {
    id: "jacks", name: "Jacks", focus: "cardio",
    levels: [v("Step jacks", "Step out, arms up, step in"), v("Jumping jacks", "Light on your feet"), v("Star jumps", "Jump wide, arms and legs out", "high")],
    instead: { knees: { ...v("Step jacks", "Step side to side, arms up"), anim: "jacks" } },
  },
  {
    id: "lunge", name: "Lunges", focus: "legs",
    levels: [v("Supported split squat", "Hold a chair, lower straight down"), v("Reverse lunge", "Step back, both knees bend"), v("Jump lunge", "Switch legs in the air", "high")],
    instead: { knees: { ...v("Standing leg lifts", "Hold a chair, lift one leg out to the side"), anim: "leglift" } },
  },
  {
    id: "plank", name: "Plank", focus: "core",
    levels: [v("Couch plank", "Hands on the couch, body straight"), v("Plank", "Forearms down, hold still"), v("Plank shoulder taps", "Tap each shoulder, hips still")],
    instead: { back: { ...v("Dead bug", "On your back, slow and controlled"), anim: "deadbug" }, shoulders: { ...v("Dead bug", "On your back, slow and controlled"), anim: "deadbug" }, wrists: { ...v("Forearm plank on the couch", "Forearms on the couch, body straight"), anim: "plank" } },
  },
  {
    id: "shuffle", name: "Side steps", focus: "cardio",
    levels: [v("Step touch", "Step to the side and tap"), v("Side shuffle", "Stay low, quick steps"), v("Skater hops", "Leap side to side", "high")],
    instead: { knees: { ...v("Step touch", "Small steps side to side"), anim: "shuffle" } },
  },
  {
    id: "birddog", name: "Bird dog", focus: "core",
    levels: [v("Bird dog, arms only", "On hands and knees, reach one arm"), v("Bird dog", "Opposite arm and leg, hold two seconds"), v("Bird dog crunch", "Reach out, then elbow to knee")],
    instead: { wrists: { ...v("Standing knee to elbow", "Stand tall, slow knee to opposite elbow"), anim: "march" }, knees: { ...v("Standing knee to elbow", "Stand tall, slow knee to opposite elbow"), anim: "march" } },
  },
  {
    id: "stretch", name: "Reach and fold", focus: "cooldown",
    levels: [v("Reach and soft fold", "Reach up, then bend your knees and fold"), v("Reach and fold", "Reach up tall, fold down slowly"), v("Reach, fold, and walk out", "Fold down, walk your hands out and back")],
    instead: { back: { ...v("Overhead reach", "Reach up, breathe out, arms down"), anim: "circles" } },
  },
];

const BY_ID = Object.fromEntries(MOVES.map((m) => [m.id, m]));
export const moveById = (id: string) => BY_ID[id];

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
  kind: "warmup" | "work" | "rest" | "cooldown";
  seconds: number;
  per_member: PersonalVariation[];
}

export interface Plan {
  minutes: number;
  focus: string;
  blocks: Block[];
  notes: string[]; // facts the coach may mention, already in plain words
  member_levels: Record<string, number>;
}

export function effectiveLevel(m: Member, c?: Checkin): number {
  let level = m.level;
  if (c && c.energy <= 2) level -= 1;
  return Math.max(1, Math.min(3, level));
}

export function variationFor(move: Move, m: Member, c?: Checkin): PersonalVariation & { reason?: string } {
  const sore = (c?.sore ?? []).find((s) => move.instead?.[s]);
  if (sore) {
    const alt = move.instead![sore]!;
    return { member_id: m.id, name: alt.name, cue: alt.cue, anim: alt.anim, why: `easy on the ${sore}` };
  }
  let lvl = effectiveLevel(m, c);
  let pick = move.levels[lvl - 1];
  // Never put a low-impact person, or anyone with sore knees, on a jumping version.
  while (pick.impact === "high" && (m.low_impact || c?.sore.includes("knees")) && lvl > 1) pick = move.levels[--lvl - 1];
  const why = lvl < m.level ? (c && c.energy <= 2 ? "low energy today" : "no jumping") : undefined;
  return { member_id: m.id, name: pick.name, cue: pick.cue, anim: pick.anim ?? move.id, why };
}

// Which part of the body to work today: whatever the household trained least recently.
export function pickFocus(history: PastSession[]): "legs" | "upper" | "core" {
  const order: ("legs" | "upper" | "core")[] = ["legs", "upper", "core"];
  const last: Record<string, number> = { legs: 0, upper: 0, core: 0 };
  for (const s of history) if (s.focus in last) last[s.focus] = Math.max(last[s.focus], s.started_at);
  return [...order].sort((a, b) => last[a] - last[b])[0];
}

// Session length: the household's own pattern decides. If the last sessions at this time of
// day were cut short, plan shorter; if the room is tired, plan gentler and shorter.
export function pickMinutes(history: PastSession[], localHour: number, checkins: Checkin[]): { minutes: number; reason?: string } {
  const sameSlot = history.filter((s) => Math.abs(s.local_hour - localHour) <= 2).slice(-4);
  const avgEnergy = checkins.length ? checkins.reduce((a, c) => a + c.energy, 0) / checkins.length : 3;
  let minutes = 12;
  let reason: string | undefined;
  if (sameSlot.length >= 2) {
    const early = sameSlot.filter((s) => s.completed_blocks < s.planned_blocks).length;
    // The reason says which way the length moved, so nobody (the coach's model included) reads
    // "ended early" as "needs more time".
    if (early * 2 > sameSlot.length) { minutes = 8; reason = `${early} of your last ${sameSlot.length} sessions around this time ended early, so today is shorter: 8 minutes instead of 12`; }
    else if (early === 0 && sameSlot.length >= 3) { minutes = 15; reason = `you finished your last ${sameSlot.length} sessions around this time, so today is longer: 15 minutes instead of 12`; }
  }
  if (avgEnergy <= 2.2 && minutes > 8) { minutes = 8; reason = "energy is low in the room, so today is shorter: a gentle 8 minutes instead of 12"; }
  return { minutes, reason };
}

const WORK_SECONDS = 40;
const REST_SECONDS = 20;

export function buildPlan(members: Member[], checkins: Checkin[], history: PastSession[], localHour: number): Plan {
  const byMember = Object.fromEntries(checkins.map((c) => [c.member_id, c]));
  const focus = pickFocus(history);
  const { minutes, reason } = pickMinutes(history, localHour, checkins);
  const pool: Record<string, string[]> = {
    legs: ["squat", "jacks", "lunge", "plank"],
    upper: ["pushup", "shuffle", "plank", "squat"],
    core: ["plank", "jacks", "birddog", "lunge"],
  };
  const workMoves = pool[focus];
  const workBlocks = minutes - 3; // 2 minutes warm-up, 1 minute cool-down, 1 minute per work block
  const blocks: Block[] = [];
  const personal = (moveId: string) => members.map((m) => {
    const p = variationFor(BY_ID[moveId], m, byMember[m.id]);
    return { member_id: p.member_id, name: p.name, cue: p.cue, anim: p.anim, ...(p.why ? { why: p.why } : {}) };
  });
  for (const id of ["march", "circles"]) blocks.push({ move_id: id, move: BY_ID[id].name, kind: "warmup", seconds: 60, per_member: personal(id) });
  for (let i = 0; i < workBlocks; i++) {
    const id = workMoves[i % workMoves.length];
    blocks.push({ move_id: id, move: BY_ID[id].name, kind: "work", seconds: WORK_SECONDS, per_member: personal(id) });
    const next = i + 1 < workBlocks ? workMoves[(i + 1) % workMoves.length] : "stretch";
    blocks.push({ move_id: next, move: BY_ID[next].name, kind: "rest", seconds: REST_SECONDS, per_member: personal(next) });
  }
  blocks.push({ move_id: "stretch", move: BY_ID.stretch.name, kind: "cooldown", seconds: 60, per_member: personal("stretch") });

  const notes: string[] = [];
  if (reason) notes.push(reason);
  notes.push(`today's focus is ${focus}, the area you trained least recently`);
  const SORE_WORD: Record<Sore, string> = { knees: "knee", back: "back", shoulders: "shoulder", wrists: "wrist" };
  for (const m of members) {
    const c = byMember[m.id];
    if (c?.sore.length) {
      const words = c.sore.map((x) => SORE_WORD[x]);
      notes.push(`${m.name} gets ${words.length > 1 ? words.slice(0, -1).map((w) => w + "-").join(", ") + " and " + words.at(-1) : words[0]}-friendly versions`);
    } else if (c && c.energy <= 2 && m.level > 1) {
      // Only said when it changes something: level 1 is already the gentlest.
      notes.push(`${m.name} is low on energy, so ${m.name} goes one level easier`);
    }
  }
  return { minutes, focus, blocks, notes, member_levels: Object.fromEntries(members.map((m) => [m.id, m.level])) };
}

// Where the session is right now, computed the same way on the TV and on every phone.
export interface Timing { started_at: number | null; paused_at: number | null; paused_ms: number; offset_ms: number; ended_at?: number | null }

// ended_at is set when the TV ends a session early: from then on everyone sees it as over.
export function position(plan: Plan, t: Timing, now: number): { index: number; remaining: number; done: boolean } {
  if (!t.started_at) return { index: 0, remaining: plan.blocks[0]?.seconds ?? 0, done: false };
  const end = t.paused_at ?? t.ended_at ?? now;
  let elapsed = (end - t.started_at - t.paused_ms + t.offset_ms) / 1000;
  for (let i = 0; i < plan.blocks.length; i++) {
    if (elapsed < plan.blocks[i].seconds) return { index: i, remaining: t.ended_at ? 0 : Math.ceil(plan.blocks[i].seconds - elapsed), done: !!t.ended_at };
    elapsed -= plan.blocks[i].seconds;
  }
  return { index: plan.blocks.length - 1, remaining: 0, done: true };
}

// Work blocks finished: every work block before the one in progress, or all of them if the
// clock ran out. A block that was cut short by "End" doesn't count.
export function completedWork(plan: Plan, t: Timing, now: number): number {
  const p = position(plan, { ...t, ended_at: null }, t.ended_at ?? now);
  return plan.blocks.slice(0, p.done ? plan.blocks.length : p.index).filter((b) => b.kind === "work").length;
}

// Seconds from the start of the plan to the beginning of block i (used to skip forward or back).
export const blockStart = (plan: Plan, i: number) => plan.blocks.slice(0, i).reduce((a, b) => a + b.seconds, 0);

export type Rating = "easy" | "right" | "hard";

// After the session: each person's rating moves their level. Two "easy" sessions in a row
// level you up; one "hard" levels you down. Returns plain-language changes.
export function adapt(members: Member[], ratings: Record<string, Rating>, previous: Record<string, Rating[]>): { level: Record<string, number>; changes: string[] } {
  const level: Record<string, number> = {};
  const changes: string[] = [];
  for (const m of members) {
    const r = ratings[m.id];
    let next = m.level;
    if (r === "hard" && m.level > 1) { next = m.level - 1; changes.push(`${m.name} found it hard, so next time ${m.name} starts one level easier`); }
    else if (r === "easy" && (previous[m.id] ?? []).slice(-1)[0] === "easy" && m.level < 3) { next = m.level + 1; changes.push(`${m.name} said "easy" twice in a row, so ${m.name} moves up to level ${next}`); }
    else if (r === "easy") changes.push(`${m.name} found it easy; one more easy session and ${m.name} levels up`);
    level[m.id] = next;
  }
  return { level, changes };
}
