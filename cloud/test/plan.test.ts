// Planner rules. Run: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { adapt, blockStart, buildPlan, MOVES, pickFocus, pickMinutes, position, variationFor } from "../src/plan.ts";
import type { Member, PastSession } from "../src/plan.ts";

const M = (id: string, level: number, low_impact = 0): Member => ({ id, name: id[0].toUpperCase() + id.slice(1), color: "#fff", level, low_impact });
const move = (id: string) => MOVES.find((m) => m.id === id)!;
const past = (ago: number, focus: string, planned: number, done: number, hour = 18): PastSession => ({ started_at: 1_000_000_000 - ago * 86_400_000, planned_blocks: planned, completed_blocks: done, weekday: 1, local_hour: hour, focus });

test("each level gets its own version of the same move", () => {
  assert.equal(variationFor(move("squat"), M("a", 1)).name, "Chair squat");
  assert.equal(variationFor(move("squat"), M("b", 2)).name, "Bodyweight squat");
  assert.equal(variationFor(move("squat"), M("c", 3)).name, "Jump squat");
});

test("a sore area swaps in a move that spares it, with the reason", () => {
  const v = variationFor(move("squat"), M("a", 3), { member_id: "a", energy: 4, sore: ["knees"] });
  assert.equal(v.name, "Glute bridge");
  assert.equal(v.why, "easy on the knees");
});

test("low-impact members never get a jumping version", () => {
  for (const mv of MOVES) {
    const v = variationFor(mv, M("joe", 3, 1));
    const lvl = mv.levels.find((l) => l.name === v.name);
    assert.ok(!lvl || lvl.impact === "low", `${mv.id} gave ${v.name}`);
  }
});

test("low energy goes one level easier", () => {
  assert.equal(variationFor(move("pushup"), M("a", 3), { member_id: "a", energy: 2, sore: [] }).name, "Knee push-up");
});

test("focus is the area trained least recently", () => {
  assert.equal(pickFocus([past(5, "core", 9, 9), past(3, "legs", 9, 9), past(1, "upper", 9, 9)]), "core");
  assert.equal(pickFocus([]), "legs");
});

test("sessions that keep ending early at this hour make the plan shorter, and say why accurately", () => {
  const r = pickMinutes([past(9, "legs", 9, 9), past(6, "core", 9, 5), past(4, "legs", 9, 6), past(2, "upper", 9, 6)], 18, []);
  assert.equal(r.minutes, 8);
  assert.match(r.reason!, /^3 of your last 4 sessions/);
  assert.equal(pickMinutes([past(6, "core", 9, 5), past(2, "upper", 9, 6)], 9, []).minutes, 12, "other hours don't count");
  assert.equal(pickMinutes([past(6, "a", 9, 9), past(4, "b", 9, 9), past(2, "c", 9, 9)], 18, []).minutes, 15);
  assert.equal(pickMinutes([], 18, [{ member_id: "a", energy: 1, sore: [] }, { member_id: "b", energy: 2, sore: [] }]).minutes, 8);
});

test("plan: warm-up, work and rest, cool-down; minutes match the blocks", () => {
  const ms = [M("maya", 2), M("joe", 1, 1)];
  const p = buildPlan(ms, [{ member_id: "maya", energy: 3, sore: ["knees"] }], [], 18);
  assert.equal(p.minutes, 12);
  assert.deepEqual([p.blocks[0].kind, p.blocks[1].kind, p.blocks.at(-1)!.kind], ["warmup", "warmup", "cooldown"]);
  const total = p.blocks.reduce((a, b) => a + b.seconds, 0);
  assert.equal(total, p.minutes * 60);
  for (const b of p.blocks) assert.equal(b.per_member.length, 2);
  assert.ok(p.notes.some((n) => n.includes("Maya gets knees-friendly")));
  // Rest blocks preview the next move.
  const i = p.blocks.findIndex((b) => b.kind === "rest");
  assert.equal(p.blocks[i].move_id, p.blocks[i + 1].move_id);
});

test("position follows the clock, pauses, and skips", () => {
  const p = buildPlan([M("a", 2)], [], [], 18);
  const t0 = 1_000_000;
  assert.deepEqual(position(p, { started_at: t0, paused_at: null, paused_ms: 0, offset_ms: 0 }, t0 + 30_000), { index: 0, remaining: 30, done: false });
  assert.equal(position(p, { started_at: t0, paused_at: null, paused_ms: 0, offset_ms: 0 }, t0 + 61_000).index, 1);
  assert.equal(position(p, { started_at: t0, paused_at: t0 + 10_000, paused_ms: 0, offset_ms: 0 }, t0 + 500_000).remaining, 50);
  assert.equal(position(p, { started_at: t0, paused_at: null, paused_ms: 0, offset_ms: blockStart(p, 3) * 1000 }, t0).index, 3);
  assert.equal(position(p, { started_at: t0, paused_at: null, paused_ms: 0, offset_ms: 0 }, t0 + 3_600_000).done, true);
});

test("ratings move levels: two easy in a row up, hard down", () => {
  const ms = [M("lily", 2), M("maya", 2), M("ben", 2), M("joe", 1)];
  const r = adapt(ms, { lily: "easy", maya: "hard", ben: "easy", joe: "hard" }, { lily: ["right", "easy"], ben: ["right"] });
  assert.deepEqual(r.level, { lily: 3, maya: 1, ben: 2, joe: 1 });
  assert.ok(r.changes.some((c) => c.includes("Lily moves up to level 3")));
  assert.ok(r.changes.some((c) => c.includes("one more easy session")));
  assert.ok(!r.changes.some((c) => c.startsWith("Joe")), "level 1 can't go lower, so nothing to announce");
});
