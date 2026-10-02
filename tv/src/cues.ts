import {Block, Member} from './api';

// What the coach says when a block starts. Only people whose version differs from the most
// common one are named, so the line stays short.
export function cueFor(b: Block, next: Block | undefined, people: Member[]): string {
  if (b.kind === 'rest') return `Rest. Next up, ${b.move.toLowerCase()}.`;
  // The "common" version is the one most people do; on a tie, the one nobody had adjusted.
  const score = new Map<string, number>();
  for (const v of b.per_member) score.set(v.name, (score.get(v.name) ?? 0) + 1 + (v.why ? 0 : 0.1));
  const common = [...score.entries()].sort((a, c) => c[1] - a[1])[0]?.[0];
  const callouts = b.per_member
    .filter(v => v.name !== common)
    .map(v => `${people.find(m => m.id === v.member_id)?.name ?? ''}, ${v.name.toLowerCase()}`)
    .slice(0, 3);
  const head = b.kind === 'warmup' ? `Warm-up. ${b.move}.` : b.kind === 'cooldown' ? `Cool-down. ${b.move}. Breathe out slowly.` : `${b.move}!`;
  return [head, ...callouts.map(c => c + '.')].join(' ');
}
