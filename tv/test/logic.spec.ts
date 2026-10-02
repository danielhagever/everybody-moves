import {cueFor, sentences} from '../src/cues';
import {Block, Member, Plan, position} from '../src/api';

const people: Member[] = [
  {id: 'm', name: 'Maya', color: '#f80', level: 2, low_impact: 0},
  {id: 'b', name: 'Ben', color: '#4cf', level: 2, low_impact: 0},
  {id: 'l', name: 'Lily', color: '#be8', level: 2, low_impact: 0},
  {id: 'j', name: 'Grandpa Joe', color: '#fbd', level: 1, low_impact: 1},
];
const v = (member_id: string, name: string, why?: string) => ({member_id, name, cue: '', anim: 'squat', ...(why ? {why} : {})});

describe('coach cues', () => {
  it('names only the people whose version differs', () => {
    const b: Block = {move_id: 'squat', move: 'Squats', kind: 'work', seconds: 40, per_member: [v('m', 'Glute bridge', 'easy on the knees'), v('b', 'Bodyweight squat'), v('l', 'Bodyweight squat'), v('j', 'Chair squat')]};
    expect(cueFor(b, undefined, people)).toBe('Squats! Maya, glute bridge. Grandpa Joe, chair squat.');
  });
  it('on a tie, the unadjusted version counts as the common one', () => {
    const b: Block = {move_id: 'jacks', move: 'Jacks', kind: 'work', seconds: 40, per_member: [v('m', 'Step jacks', 'easy on the knees'), v('b', 'Jumping jacks'), v('l', 'Jumping jacks'), v('j', 'Step jacks')]};
    expect(cueFor(b, undefined, people)).toBe('Jacks! Maya, step jacks. Grandpa Joe, step jacks.');
  });
  it('rest blocks announce the next move', () => {
    const b: Block = {move_id: 'plank', move: 'Plank', kind: 'rest', seconds: 20, per_member: []};
    expect(cueFor(b, undefined, people)).toBe('Rest. Next up, plank.');
  });
});

describe('session clock', () => {
  const plan: Plan = {minutes: 1, focus: 'legs', notes: [], member_levels: {}, blocks: [
    {move_id: 'march', move: 'March', kind: 'warmup', seconds: 60, per_member: []},
    {move_id: 'squat', move: 'Squats', kind: 'work', seconds: 40, per_member: []},
  ]};
  const t0 = 1_000_000;
  it('follows the shared start time and pauses', () => {
    expect(position(plan, {started_at: t0, paused_at: null, paused_ms: 0, offset_ms: 0}, t0 + 70_000)).toEqual({index: 1, remaining: 30, done: false});
    expect(position(plan, {started_at: t0, paused_at: t0 + 10_000, paused_ms: 0, offset_ms: 0}, t0 + 99_000).remaining).toBe(50);
  });
  it('is over for everyone once the TV ends it', () => {
    expect(position(plan, {started_at: t0, paused_at: null, paused_ms: 0, offset_ms: 0, ended_at: t0 + 5_000}, t0 + 6_000)).toEqual({index: 0, remaining: 0, done: true});
  });
});

describe('introduction sentences', () => {
  it('splits the same way as the service', () => {
    expect(sentences('Hello Maya. Today is 8 minutes instead of 12! Let\'s go')).toEqual(['Hello Maya.', 'Today is 8 minutes instead of 12!', "Let's go"]);
  });
});
