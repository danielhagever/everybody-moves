// The coach's guardrails. Run: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptable, templateIntro } from "../src/coach.ts";
import { buildPlan } from "../src/plan.ts";
import type { Member } from "../src/plan.ts";

const people: Member[] = [
  { id: "m", name: "Maya", color: "#f80", level: 2, low_impact: 0 },
  { id: "j", name: "Grandpa Joe", color: "#fbd", level: 1, low_impact: 1 },
];
const plan = buildPlan(people, [{ member_id: "m", energy: 3, sore: ["knees"] }], [], 18);

test("a good intro passes", () => {
  assert.ok(acceptable("Welcome, Maya and Grandpa Joe! Twelve minutes on legs today. Maya gets knee-friendly versions.", people, plan));
});

test("numbers the plan doesn't back up are rejected, in digits or words", () => {
  assert.ok(!acceptable("Welcome, Maya and Grandpa Joe! Today is 20 minutes on legs.", people, plan));
  assert.ok(!acceptable("Welcome, Maya and Grandpa Joe! Today is twenty minutes on legs.", people, plan));
  assert.ok(acceptable(`Welcome, Maya and Grandpa Joe! Today is ${plan.minutes} minutes on legs.`, people, plan));
});

test("guessed pronouns are rejected", () => {
  assert.ok(!acceptable("Welcome, Maya and Grandpa Joe! Maya gets gentler moves for her knees.", people, plan));
});

test("everyone must be named, and it must stay short", () => {
  assert.ok(!acceptable("Welcome, Maya! Let's go.", people, plan));
  assert.ok(!acceptable("Welcome Maya and Grandpa Joe. " + "Keep going. ".repeat(40), people, plan));
});

test("the template fallback names everyone and states the plan", () => {
  const t = templateIntro(people, plan);
  assert.match(t, /Maya and Grandpa Joe/);
  assert.match(t, new RegExp(`${plan.minutes} minutes`));
  assert.ok(acceptable(t, people, plan) || t.split(/\s+/).length > 60);
});

test("names that aren't in the household are rejected", () => {
  // A real reply from the model on 2026-10-02, with nobody needing adjustments.
  assert.ok(!acceptable("Hi Maya and Grandpa Joe, today's session is 12 minutes on legs. Alex and Sam will get gentler versions.", people, plan));
  assert.ok(acceptable("Hi Maya and Grandpa Joe! Today's session is 12 minutes on legs, since legs is the area you trained least recently.", people, plan));
});

test("a reply that turns a shorter session into a longer one is rejected", () => {
  const short = buildPlan(people, [], [
    { started_at: 1, planned_blocks: 9, completed_blocks: 5, weekday: 1, local_hour: 18, focus: "legs" },
    { started_at: 2, planned_blocks: 9, completed_blocks: 6, weekday: 1, local_hour: 18, focus: "core" },
  ], 18);
  assert.equal(short.minutes, 8);
  assert.match(short.notes[0], /shorter: 8 minutes instead of 12/);
  // Real replies from the model on 2026-10-02.
  assert.ok(!acceptable("Hello Maya and Grandpa Joe, today's 8-minute session focuses on legs. Since 2 of your last 2 sessions ended early, we need a bit more time.", people, short));
  assert.ok(!acceptable("Hello Maya and Grandpa Joe, today is 8 minutes on legs, so we're going a bit longer.", people, short));
  assert.ok(acceptable("Hello Maya and Grandpa Joe, today is a shorter 8 minutes on legs, since 2 of your last 2 sessions ended early.", people, short));
});
