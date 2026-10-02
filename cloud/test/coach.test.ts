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

test("numbers the plan doesn't back up are rejected", () => {
  assert.ok(!acceptable("Welcome, Maya and Grandpa Joe! Today is 20 minutes on legs.", people, plan));
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
