// A stick figure that demonstrates each move, drawn with react-native-svg. Every animation is a
// few key poses (joint positions in a 200 x 200 box, floor at y = 188) blended with a smooth
// back-and-forth, so the figure needs no images or video and stays crisp at any size.
import React from 'react';
import {Svg, Circle, Line, G} from '@amazon-devices/react-native-svg';

type P = [number, number];
interface Pose {
  head: P; neck: P; hip: P;
  lElbow: P; lHand: P; rElbow: P; rHand: P;
  lKnee: P; lFoot: P; rKnee: P; rFoot: P;
}

const STAND: Pose = {
  head: [100, 38], neck: [100, 58], hip: [100, 112],
  lElbow: [84, 86], lHand: [80, 112], rElbow: [116, 86], rHand: [120, 112],
  lKnee: [93, 150], lFoot: [91, 188], rKnee: [107, 150], rFoot: [109, 188],
};
const SIDE: Pose = {
  head: [100, 38], neck: [100, 58], hip: [100, 112],
  lElbow: [98, 86], lHand: [100, 112], rElbow: [102, 86], rHand: [104, 112],
  lKnee: [98, 150], lFoot: [98, 188], rKnee: [104, 150], rFoot: [104, 188],
};
const pose = (base: Pose, over: Partial<Pose>): Pose => ({...base, ...over});
const mirror = (p: Pose): Pose => ({
  ...p,
  lElbow: [200 - p.rElbow[0], p.rElbow[1]], lHand: [200 - p.rHand[0], p.rHand[1]],
  rElbow: [200 - p.lElbow[0], p.lElbow[1]], rHand: [200 - p.lHand[0], p.lHand[1]],
  lKnee: [200 - p.rKnee[0], p.rKnee[1]], lFoot: [200 - p.rFoot[0], p.rFoot[1]],
  rKnee: [200 - p.lKnee[0], p.lKnee[1]], rFoot: [200 - p.lFoot[0], p.lFoot[1]],
});

const MARCH_A = pose(STAND, {lKnee: [90, 124], lFoot: [94, 156], rElbow: [116, 76], rHand: [110, 60], lElbow: [86, 90], lHand: [88, 116]});
const OUT = pose(STAND, {lElbow: [72, 58], lHand: [44, 58], rElbow: [128, 58], rHand: [156, 58]});
const SQUAT_DOWN = pose(SIDE, {head: [112, 70], neck: [104, 88], hip: [72, 138], lKnee: [108, 140], lFoot: [100, 188], rKnee: [112, 142], rFoot: [104, 188], lElbow: [124, 96], lHand: [150, 94], rElbow: [126, 98], rHand: [152, 96]});
const SQUAT_UP = pose(SIDE, {lElbow: [116, 82], lHand: [138, 80], rElbow: [118, 84], rHand: [140, 82]});
const LUNGE_DOWN = pose(SIDE, {head: [100, 66], neck: [100, 86], hip: [100, 134], lKnee: [126, 142], lFoot: [128, 188], rKnee: [90, 178], rFoot: [62, 186], lElbow: [98, 110], lHand: [100, 134], rElbow: [102, 110], rHand: [104, 134]});
// Floor moves are seen from the side, lying along the floor.
const PUSH_UP: Pose = {head: [162, 112], neck: [146, 122], hip: [94, 148], lElbow: [146, 156], lHand: [146, 188], rElbow: [150, 156], rHand: [150, 188], lKnee: [64, 164], lFoot: [34, 184], rKnee: [66, 166], rFoot: [36, 186]};
const PUSH_DOWN: Pose = {head: [166, 160], neck: [150, 168], hip: [96, 174], lElbow: [126, 160], lHand: [146, 188], rElbow: [130, 162], rHand: [150, 188], lKnee: [64, 180], lFoot: [34, 186], rKnee: [66, 181], rFoot: [36, 187]};
const PLANK_A: Pose = {head: [164, 140], neck: [148, 148], hip: [96, 160], lElbow: [146, 186], lHand: [172, 186], rElbow: [150, 186], rHand: [176, 186], lKnee: [64, 172], lFoot: [34, 186], rKnee: [66, 173], rFoot: [36, 187]};
const PLANK_B = pose(PLANK_A, {hip: [96, 156]});
const BRIDGE_DOWN: Pose = {head: [36, 176], neck: [54, 178], hip: [102, 182], lElbow: [74, 186], lHand: [94, 186], rElbow: [76, 186], rHand: [96, 186], lKnee: [134, 144], lFoot: [148, 186], rKnee: [136, 146], rFoot: [150, 186]};
const BRIDGE_UP = pose(BRIDGE_DOWN, {hip: [104, 146], lKnee: [138, 134], rKnee: [140, 136]});
const BUG_A: Pose = {head: [36, 170], neck: [54, 174], hip: [104, 178], lElbow: [58, 142], lHand: [60, 114], rElbow: [62, 142], rHand: [64, 114], lKnee: [108, 140], lFoot: [138, 140], rKnee: [112, 142], rFoot: [142, 142]};
const BUG_B = pose(BUG_A, {lElbow: [36, 158], lHand: [16, 168], lKnee: [136, 166], lFoot: [172, 176]});
const DOG_A: Pose = {head: [154, 112], neck: [140, 126], hip: [80, 128], lElbow: [140, 158], lHand: [140, 188], rElbow: [144, 158], rHand: [144, 188], lKnee: [80, 188], lFoot: [44, 188], rKnee: [84, 188], rFoot: [48, 188]};
const DOG_B = pose(DOG_A, {rElbow: [164, 122], rHand: [190, 116], rKnee: [52, 126], rFoot: [20, 122]});
const JACK_IN = STAND;
const JACK_OUT = pose(STAND, {lElbow: [76, 38], lHand: [62, 16], rElbow: [124, 38], rHand: [138, 16], lKnee: [80, 150], lFoot: [64, 188], rKnee: [120, 150], rFoot: [136, 188]});
const SHUFFLE_L = pose(STAND, {head: [84, 46], neck: [84, 66], hip: [84, 120], lElbow: [70, 90], lHand: [80, 100], rElbow: [98, 90], rHand: [90, 100], lKnee: [66, 152], lFoot: [58, 188], rKnee: [104, 152], rFoot: [110, 188]});
const SHUFFLE_R = mirror(SHUFFLE_L);
const LIFT = pose(STAND, {rKnee: [126, 144], rFoot: [150, 172], lElbow: [80, 80], lHand: [64, 98]});
const REACH = pose(SIDE, {lElbow: [100, 30], lHand: [100, 6], rElbow: [104, 30], rHand: [104, 6]});
// Seated march, side view, on a chair.
const SIT: Pose = {head: [90, 50], neck: [90, 70], hip: [90, 124], lElbow: [98, 100], lHand: [112, 118], rElbow: [100, 102], rHand: [114, 120], lKnee: [130, 126], lFoot: [132, 188], rKnee: [132, 128], rFoot: [134, 188]};
const SIT_LIFT = pose(SIT, {lKnee: [126, 102], lFoot: [138, 150]});
// Wall push-up, side view, hands on a wall at the right.
const WALL_OUT: Pose = {head: [150, 50], neck: [140, 66], hip: [116, 120], lElbow: [156, 70], lHand: [170, 70], rElbow: [158, 72], rHand: [170, 74], lKnee: [106, 154], lFoot: [96, 188], rKnee: [108, 155], rFoot: [98, 188]};
const WALL_IN = pose(WALL_OUT, {head: [160, 58], neck: [150, 74], hip: [122, 124], lElbow: [150, 92], rElbow: [152, 94], lKnee: [110, 156], rKnee: [112, 157]});
// Knee push-up: knees on the floor, feet raised.
const KNEE_UP: Pose = {head: [162, 114], neck: [146, 124], hip: [100, 154], lElbow: [146, 156], lHand: [146, 188], rElbow: [150, 156], rHand: [150, 188], lKnee: [76, 186], lFoot: [46, 162], rKnee: [78, 187], rFoot: [48, 164]};
const KNEE_DOWN = pose(KNEE_UP, {head: [166, 160], neck: [150, 168], hip: [104, 176], lElbow: [128, 160], rElbow: [132, 162]});
const FOLD = pose(SIDE, {head: [140, 150], neck: [128, 132], hip: [100, 112], lElbow: [130, 158], lHand: [126, 182], rElbow: [134, 158], rHand: [130, 182], lKnee: [104, 150], rKnee: [108, 150]});

// Each animation: key poses and seconds per full cycle.
const ANIMS: Record<string, {frames: Pose[]; period: number; floor?: boolean; prop?: 'chair' | 'wall'}> = {
  seatedmarch: {frames: [SIT, SIT_LIFT], period: 1.4, prop: 'chair'},
  wallpush: {frames: [WALL_OUT, WALL_IN], period: 2.2, prop: 'wall'},
  kneepush: {frames: [KNEE_UP, KNEE_DOWN], period: 2.2, floor: true},
  march: {frames: [MARCH_A, STAND, mirror(MARCH_A), STAND], period: 1.2},
  circles: {frames: [OUT, pose(OUT, {lHand: [42, 44], rHand: [158, 44]}), pose(OUT, {lHand: [30, 58], rHand: [170, 58]}), pose(OUT, {lHand: [42, 72], rHand: [158, 72]})], period: 1.2},
  squat: {frames: [SQUAT_UP, SQUAT_DOWN], period: 2.4},
  lunge: {frames: [SIDE, LUNGE_DOWN], period: 2.4},
  pushup: {frames: [PUSH_UP, PUSH_DOWN], period: 2.2, floor: true},
  plank: {frames: [PLANK_A, PLANK_B], period: 3.2, floor: true},
  bridge: {frames: [BRIDGE_DOWN, BRIDGE_UP], period: 2.4, floor: true},
  deadbug: {frames: [BUG_A, BUG_B], period: 2.8, floor: true},
  birddog: {frames: [DOG_A, DOG_B], period: 2.8, floor: true},
  jacks: {frames: [JACK_IN, JACK_OUT], period: 1.0},
  shuffle: {frames: [SHUFFLE_L, SHUFFLE_R], period: 1.2},
  leglift: {frames: [STAND, LIFT], period: 2.0},
  stretch: {frames: [REACH, FOLD], period: 4.0},
};

const lerp = (a: P, b: P, k: number): P => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

export function poseAt(anim: string, t: number): Pose {
  const a = ANIMS[anim] ?? ANIMS.march;
  const n = a.frames.length;
  // Two-frame moves go there and back; longer ones cycle in order.
  const cycle = ((t % a.period) + a.period) % a.period / a.period;
  let from: Pose, to: Pose, k: number;
  if (n === 2) {
    const s = (1 - Math.cos(cycle * 2 * Math.PI)) / 2;
    from = a.frames[0]; to = a.frames[1]; k = s;
  } else {
    const x = cycle * n;
    const i = Math.floor(x) % n;
    from = a.frames[i]; to = a.frames[(i + 1) % n];
    k = (1 - Math.cos((x - Math.floor(x)) * Math.PI)) / 2;
  }
  const out = {} as Pose;
  (Object.keys(from) as (keyof Pose)[]).forEach(j => (out[j] = lerp(from[j], to[j], k)));
  return out;
}

export function Figure({anim, t, size, color, still}: {anim: string; t: number; size: number; color: string; still?: boolean}) {
  const p = poseAt(anim, still ? 0 : t);
  const prop = ANIMS[anim]?.prop;
  const w = 9;
  const bone = (a: P, b: P, key: string, opacity = 1) => (
    <Line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={w} strokeLinecap="round" opacity={opacity} />
  );
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Line x1={10} y1={192} x2={190} y2={192} stroke="#3A4150" strokeWidth={3} strokeLinecap="round" />
      {prop === 'chair' ? (
        <G>
          <Line x1={66} y1={130} x2={112} y2={130} stroke="#4A5263" strokeWidth={6} strokeLinecap="round" />
          <Line x1={68} y1={130} x2={68} y2={190} stroke="#4A5263" strokeWidth={5} />
          <Line x1={110} y1={130} x2={110} y2={190} stroke="#4A5263" strokeWidth={5} />
          <Line x1={68} y1={130} x2={68} y2={74} stroke="#4A5263" strokeWidth={6} strokeLinecap="round" />
        </G>
      ) : null}
      {prop === 'wall' ? <Line x1={176} y1={14} x2={176} y2={192} stroke="#4A5263" strokeWidth={8} /> : null}
      <G>
        {bone(p.hip, p.rKnee, 'rt', 0.55)}
        {bone(p.rKnee, p.rFoot, 'rs', 0.55)}
        {bone(p.neck, p.rElbow, 'ru', 0.55)}
        {bone(p.rElbow, p.rHand, 'rf', 0.55)}
        {bone(p.neck, p.hip, 'spine')}
        {bone(p.hip, p.lKnee, 'lt')}
        {bone(p.lKnee, p.lFoot, 'ls')}
        {bone(p.neck, p.lElbow, 'lu')}
        {bone(p.lElbow, p.lHand, 'lf')}
        <Circle cx={p.head[0]} cy={p.head[1]} r={13} fill={color} />
      </G>
    </Svg>
  );
}
