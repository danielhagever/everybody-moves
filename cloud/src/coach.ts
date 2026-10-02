import type { Env } from "./db";
import type { Member, Plan } from "./plan";

// The coach's spoken introduction. The plan and every reason in it come from the planner; the
// model only turns those facts into two warm sentences. If its answer adds a number, adds a
// name that isn't in the household, drops someone, guesses pronouns, runs long, or takes too
// long, the template version is used instead, so the TV never says something the plan doesn't
// back up.

const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

export function templateIntro(members: Member[], plan: Plan): string {
  const names = members.map((m) => m.name);
  const who = names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names.at(-1) : names[0];
  const reasons = plan.notes.slice(0, 3).map((n) => n[0].toUpperCase() + n.slice(1) + ".").join(" ");
  return `Welcome, ${who}. ${plan.minutes} minutes, focused on ${plan.focus}. ${reasons}`.replace(/\s+/g, " ").trim();
}

// Numbers in digits or words ("8", "eight", "twelve"): a spelled-out number is still a claim.
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60 };
const numbers = (s: string) => new Set([
  ...(s.match(/\d+/g) ?? []).map(Number),
  ...(s.toLowerCase().match(/\b[a-z]+\b/g) ?? []).filter((w) => w in WORDS).map((w) => WORDS[w]),
]);

// Capitalized words the coach may use besides the household's names (sentence openers and the
// app's own vocabulary). Anything else capitalized is treated as an invented name.
const COMMON = new Set("I Hi Hello Hey Welcome Good Great Today This That These We We're We'll Let's Lets Let Since Because As And So Also Plus Then Now It It's Your You You're You'll Everyone Everybody Ready Our The Core Legs Upper Body First After With For To In On Here Here's Time Keep Take Enjoy Alright Okay OK Nice Moves Session Workout".split(" "));
const capitalized = (s: string) => (s.match(/\b[A-Z][A-Za-z'’]*/g) ?? []).map((w) => w.replace(/['’]s$/, ""));

export function acceptable(text: string, members: Member[], plan: Plan): boolean {
  if (!text || text.length > 420) return false;
  if (text.split(/\s+/).length > 60) return false;
  // Names don't tell us anyone's pronouns, so the coach never guesses them.
  if (/\b(he|she|him|her|his|hers|himself|herself)\b/i.test(text)) return false;
  const allowed = new Set([...numbers(plan.notes.join(" ")), plan.minutes, ...members.map((m) => m.level)]);
  for (const n of numbers(text)) if (!allowed.has(n)) return false;
  // The length moved one way; a reply that says the other way is wrong however warm it sounds.
  if (plan.minutes < 12 && /\b(longer|more time|extra time|make up|bit more)\b/i.test(text)) return false;
  if (plan.minutes > 12 && /\b(shorter|short one|keep it short|keeping it short|less time)\b/i.test(text)) return false;
  const names = new Set(members.flatMap((m) => m.name.split(" ")));
  if (capitalized(text).some((w) => !names.has(w) && !COMMON.has(w) && !(w.toLowerCase() in WORDS))) return false;
  return members.every((m) => text.includes(m.name.split(" ").at(-1)!));
}

export async function coachIntro(env: Env, members: Member[], plan: Plan): Promise<{ text: string; source: "ai" | "template" }> {
  // Reasons about the plan, and adjustments for specific people (possibly none).
  const startsWithName = (n: string) => members.some((m) => n.startsWith(m.name));
  const facts = {
    people: members.map((m) => m.name),
    minutes: plan.minutes,
    focus: plan.focus,
    reasons: plan.notes.filter((n) => !startsWithName(n)),
    adjustments: plan.notes.filter(startsWithName),
  };
  try {
    // A slow model must not hold up the TV: after 8 seconds the template is used.
    const timeout = new Promise<null>((res) => setTimeout(() => res(null), 8000));
    const r: any = await Promise.race([timeout, env.AI.run(MODEL as any, {
      messages: [
        {
          role: "system",
          content:
            "You are the friendly voice coach of a family workout app on a TV. Write what you say at the start of today's session: two or three short sentences, under 50 words in total, spoken English. Greet everyone in people by name. Say the length and the focus, and explain why, using the reasons; keep each reason's cause and effect exactly as given. If adjustments is not empty, say those adjustments; if it is empty, say nothing about gentler versions. Only mention people listed in people; never invent anyone. Do not add any fact, number, or medical claim that isn't in the facts. Refer to people only by name: never he, she, him, her, his or hers. No emojis, no lists, no quotation marks.",
        },
        { role: "user", content: JSON.stringify(facts) },
      ],
      max_tokens: 160,
      temperature: 0.2,
    })]);
    if (!r) console.error("coach: model took over 8 s, using the template");
    const text = String(r?.response ?? "").replace(/["“”]/g, "").replace(/\s+/g, " ").trim();
    if (acceptable(text, members, plan)) return { text, source: "ai" };
  } catch (e) {
    console.error("coach", String(e));
  }
  return { text: templateIntro(members, plan), source: "template" };
}
