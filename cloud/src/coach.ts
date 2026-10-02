import type { Env } from "./db";
import type { Member, Plan } from "./plan";

// The coach's spoken introduction. The plan and every reason in it come from the planner; the
// model only turns those facts into two warm sentences. If its answer adds a number, drops a
// name, or runs long, the template version is used instead, so the TV never says something
// the plan doesn't back up.

const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

export function templateIntro(members: Member[], plan: Plan): string {
  const names = members.map((m) => m.name);
  const who = names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names.at(-1) : names[0];
  const reasons = plan.notes.slice(0, 3).map((n) => n[0].toUpperCase() + n.slice(1) + ".").join(" ");
  return `Welcome, ${who}. ${plan.minutes} minutes, focused on ${plan.focus}. ${reasons}`.replace(/\s+/g, " ").trim();
}

const numbers = (s: string) => new Set((s.match(/\d+/g) ?? []).map(Number));

export function acceptable(text: string, members: Member[], plan: Plan): boolean {
  if (!text || text.length > 420) return false;
  if (text.split(/\s+/).length > 60) return false;
  // Names don't tell us anyone's pronouns, so the coach never guesses them.
  if (/\b(he|she|him|her|his|hers|himself|herself)\b/i.test(text)) return false;
  const allowed = new Set([...numbers(plan.notes.join(" ")), plan.minutes, ...members.map((m) => m.level)]);
  for (const n of numbers(text)) if (!allowed.has(n)) return false;
  return members.every((m) => text.includes(m.name.split(" ").at(-1)!));
}

export async function coachIntro(env: Env, members: Member[], plan: Plan): Promise<{ text: string; source: "ai" | "template" }> {
  const facts = {
    people: members.map((m) => m.name),
    minutes: plan.minutes,
    focus: plan.focus,
    reasons: plan.notes,
  };
  try {
    const r: any = await env.AI.run(MODEL as any, {
      messages: [
        {
          role: "system",
          content:
            "You are the friendly voice coach of a family workout app on a TV. Write what you say at the start of today's session: two or three short sentences, under 50 words in total, spoken English. Greet everyone by name. Say the length and the focus, and explain why, using the first reason given. Then mention who gets gentler versions. Do not add any fact, number, or medical claim that isn't in the facts. Refer to people only by name: never he, she, him, her, his or hers. No emojis, no lists, no quotation marks.",
        },
        { role: "user", content: JSON.stringify(facts) },
      ],
      max_tokens: 160,
      temperature: 0.4,
    });
    const text = String(r?.response ?? "").replace(/["“”]/g, "").replace(/\s+/g, " ").trim();
    if (acceptable(text, members, plan)) return { text, source: "ai" };
  } catch (e) {
    console.error("coach", String(e));
  }
  return { text: templateIntro(members, plan), source: "template" };
}
