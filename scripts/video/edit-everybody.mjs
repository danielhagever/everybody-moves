// Edits the Everybody Moves demo from raw/: the TV recording (screencapture of the Vega Virtual
// Device), two phone recordings, and timeline.json. The coach's audio is the app's own: every
// line the TV played is in timeline.lines with the moment it started, and is placed there.
// Narration (Kokoro, local) fills the gaps, with subtitles, and the coach ducks under it.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { tts } from "./lib.mjs";

const DIR = new URL("./out/everybody/", import.meta.url).pathname;
const RAW = path.join(DIR, "raw");
const WORK = path.join(DIR, "edit");
rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
const tl = JSON.parse(readFileSync(path.join(RAW, "timeline.json"), "utf8"));
// Window recordings carry the title bar; crop to the TV picture and restore 1920 x 1080.
const TVF = tl.tv?.crop ? `crop=${tl.tv.crop},scale=1920:1080,` : "";
const BASE = "https://everybody-moves.meshulam791.workers.dev";
const run = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const dur = (f) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const ev = (re, from = 0) => tl.log.find((l) => re.test(l.what) && l.t >= from)?.t;

// 1. Sync the TV video to the timeline: its first big screen change is the first ENTER (home -> lobby).
const sceneLog = execFileSync("bash", ["-c", `ffmpeg -hide_banner -i "${path.join(RAW, "tv.mov")}" -t 40 -vf "${TVF}scale=480:-1,select='gt(scene,0.1)',showinfo" -f null - 2>&1 | grep -o 'pts_time:[0-9.]*' | cut -d: -f2`]).toString().trim().split("\n").map(Number);
const firstPress = ev(/^pressed ENTER$/);
const firstChange = sceneLog.find((x) => x > firstPress - 2);
const tvOffset = firstChange - firstPress; // tv video time = timeline time + tvOffset
// Phones: their recordings start a little after the page is created, by a varying amount. Sync
// each on its first big change, the blank page turning into the join page.
const tOpen = ev(/phones open the join link/);
const phoneOffset = {};
for (const name of ["maya", "lily"]) {
  const changes = execFileSync("bash", ["-c", `ffmpeg -hide_banner -i "${path.join(RAW, name + ".webm")}" -t 40 -vf "select='gt(scene,0.3)',showinfo" -f null - 2>&1 | grep -o 'pts_time:[0-9.]*' | cut -d: -f2`]).toString().trim().split("\n").map(Number);
  // phone video time = timeline time + phoneOffset; the page paints just before goto() resolves.
  // A recording that only began once the page loaded has no blank-to-page change; it starts at
  // that moment.
  phoneOffset[name] = changes[0] > 0 ? changes[0] - (tOpen - 0.25) : -(tOpen - 0.25);
}
console.log({ firstPress, firstChange, tvOffset, phoneOffset });

// 2. What to show (timeline seconds). The edit keeps the warm-up and the part around the skip,
// and cuts the workout between them (plank and jacks) to stay under three minutes; the title
// card says so.
const tHome = Math.max(0, firstPress - 5.5);
const tLive = ev(/workout live/);
const tSkip = ev(/skipped ahead/);
const tEnd = ev(/^end$/);
// The planning wait ("The coach is planning…", about 9 s) is cut; the title card says so.
const tBuild = ev(/^pressed LEFT ENTER$/);
const tPlanReady = ev(/plan ready/);
// After the coach's introduction and the narration that follows it, the plan screen just waits
// for Start; that still stretch is cut too. This needs each coach line's length, so the coach's
// audio (the same audio the TV played; the service caches each line) is fetched first.
const lineAudio = [];
for (const [i, l] of tl.lines.entries()) {
  const f = path.join(WORK, `coach-${i}.mp3`);
  if (!existsSync(f)) writeFileSync(f, Buffer.from(await (await fetch(`${BASE}/api/tts?s=${tl.code}&t=${encodeURIComponent(l.text)}`)).arrayBuffer()));
  lineAudio.push({ f, t: (l.at - tl.T0) / 1000, d: dur(f), text: l.text });
}
const tStartPress = tl.log.find((l) => l.what === "pressed ENTER" && l.t > tPlanReady)?.t ?? tLive;
const introEndT = Math.max(tPlanReady, ...lineAudio.filter((a) => a.t < tStartPress).map((a) => a.t + a.d));
const N4_TEXT = "The language model only words the plan. Rules check every reply before it's spoken.";
const cutFrom = introEndT + 0.3 + tts(N4_TEXT, "narrator").dur + 1.0;
const cutTo = tStartPress - 0.6;
const RANGES = cutTo - cutFrom > 1
  ? [[tHome, tBuild + 0.5], [tPlanReady - 0.5, cutFrom], [cutTo, tLive + 24], [tSkip - 6, tEnd - 4]]
  : [[tHome, tBuild + 0.5], [tPlanReady - 0.5, tLive + 24], [tSkip - 6, tEnd - 4]];
console.log("ranges", RANGES);

// 3. Narration: [text, anchor in timeline seconds]. Placed in the next gap in the coach's speech.
const tRoom = ev(/^room /);
const tPlan = ev(/plan ready/);
const tOver = ev(/session over/);
const tSummary = ev(/^summary$/);
const coach = tl.lines.map((l) => ({ text: l.text, t: (l.at - tl.T0) / 1000 }));
const tRemote = ev(/^pressed DOWN ENTER$/);
const NARRATION = [
  ["This is the real app, running on the Vega Virtual Device, Amazon's Fire TV simulator, with a sample family and two weeks of history.", tHome + 0.6],
  ["Everyone joins from their phone, with the code on the TV. Maya marks sore knees, and Lily feels great.", tRoom + 1.0],
  ["Ben and Grandpa Joe join with the remote, and the coach builds today's plan from the check-ins and the family's history.", tRemote - 0.5],
  [N4_TEXT, null],
  ["Same move, different versions. The phones show each person's own version, the same timer, and captions of the coach.", tLive + 3],
  ["Every row has its own figure, cue and reason, so nobody has to ask what to do.", tLive + 18],
  ["The remote runs the session. Pause, go back, or skip ahead. This recording runs at demo pace, five times faster.", tSkip - 6],
  ["Afterwards, everyone says how it felt, on a phone or with the remote.", tOver + 1],
];
const INTRO = "One workout video can't fit a whole family. Grandpa can't jump, Mom's knee hurts, and the teenager is bored. Everybody Moves gives each person their own version of every move, in one workout on Fire TV.";
const OUTRO = "Built with React Native for Vega and the Vega media player, with a small cloud service and a hosted language model behind it. Everybody Moves. One workout, everyone's own version.";

// Map timeline seconds to output seconds (after the title card).
const intro = tts(INTRO, "narrator");
const TITLE = intro.dur + 0.9;
const toOut = (t) => {
  let acc = TITLE;
  for (const [a, b] of RANGES) {
    if (t >= a && t <= b) return acc + (t - a);
    acc += b - a;
  }
  return null;
};
const mainLen = RANGES.reduce((a, [x, y]) => a + (y - x), 0);
const outro = tts(OUTRO, "narrator");
const END = outro.dur + 1.5;
const TOTAL = TITLE + mainLen + END;
console.log({ TITLE, mainLen, END, TOTAL });

// Coach clips on the output timeline (lines inside a cut are dropped).
const coachClips = lineAudio.map((a) => ({ ...a, o: toOut(a.t) })).filter((a) => a.o != null);
// Narration clips: if the coach is mid-sentence at the anchor, start right after that line;
// never overlap other narration. Later coach cues duck under the narration.
const narr = [{ f: intro.wav, o: 0.5, d: intro.dur, text: INTRO }];
for (const [text, anchor] of NARRATION) {
  const { wav, dur: d } = tts(text, "narrator");
  // A null anchor means "right after the coach's introduction" (now several sentences: every
  // line spoken before the workout started).
  const introLines = coachClips.filter((c) => c.o < toOut(tLive));
  let o = anchor == null ? (introLines.length ? Math.max(...introLines.map((c) => c.o + c.d)) + 0.3 : null) : toOut(anchor);
  if (o == null) continue;
  const speaking = coachClips.find((c) => o >= c.o - 0.2 && o < c.o + c.d);
  if (speaking) o = speaking.o + speaking.d + 0.3;
  const prev = narr[narr.length - 1];
  o = Math.max(o, prev.o + prev.d + 0.3);
  narr.push({ f: wav, o, d, text });
}
narr.push({ f: outro.wav, o: TITLE + mainLen + 0.6, d: outro.dur, text: OUTRO });
console.log("narration", narr.map((n) => [n.o.toFixed(1), n.d.toFixed(1), n.text.slice(0, 40)]));

// 4. Stills: title card, end card, the frame around the videos, and subtitles.
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
const CSS = `html,body{margin:0;width:1920px;height:1080px;background:#0B0E13;color:#F4F1EA;font-family:"Avenir Next","Helvetica Neue",system-ui,sans-serif}`;
async function still(name, html, transparent = false) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}${transparent ? "html,body{background:transparent}" : ""}</style></head><body>${html}</body></html>`);
  const f = path.join(WORK, name + ".png");
  await page.screenshot({ path: f, omitBackground: transparent });
  return f;
}
const titlePng = await still("title", `<div style="height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 140px">
  <div style="color:#FFB547;font-weight:800;letter-spacing:.14em;font-size:26px">FIRE TV · VEGA OS</div>
  <div style="font-size:104px;font-weight:800;letter-spacing:-.02em;margin-top:18px">Everybody Moves</div>
  <div style="font-size:44px;color:#C9CED8;margin-top:18px">One family workout. Everyone's own version of every move.</div>
  <div style="font-size:26px;color:#8A91A0;margin-top:48px">Recorded on the Vega Virtual Device, with the phone page in two phone-sized browsers.<br>Demo pace (5x); waits and part of the workout are cut.</div></div>`);
const endPng = await still("end", `<div style="height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 140px">
  <div style="color:#FFB547;font-weight:800;letter-spacing:.14em;font-size:24px">HOW IT'S BUILT</div>
  <div style="font-size:64px;font-weight:800;margin:16px 0 30px">Everybody Moves</div>
  <ul style="font-size:32px;line-height:1.6;color:#D6DAE2;margin:0;padding-left:34px">
  <li>React Native for Vega: TV focus, remote events (play/pause, skip, back)</li>
  <li>Vega W3C media AudioPlayer: the coach's voice</li>
  <li>SVG on Vega: exercise figures, countdown ring, QR code</li>
  <li>A small cloud service: the planner, sessions and phone check-in</li>
  <li>A hosted language model words the coach's introduction, checked by rules; a speech model voices it</li></ul>
  <div style="font-size:26px;color:#8A91A0;margin-top:40px">github.com/danielhagever/everybody-moves</div></div>`);
// Layout: TV 1200x675 at (36,150); phones 312x675 at (1272,150) and (1604,150).
const framePng = await still("frame", `
  <div style="position:absolute;left:36px;top:52px;font-size:34px;font-weight:800">Everybody Moves <span style="color:#8A91A0;font-weight:600;font-size:26px">· Fire TV app on the Vega Virtual Device</span></div>
  <div style="position:absolute;left:1272px;top:46px;width:644px;font-size:24px;color:#8A91A0">Phones: a web page, nothing to install<br><span style="font-size:20px;color:#6B7280">shown here in phone-sized browsers</span></div>
  <div style="position:absolute;left:30px;top:144px;width:1212px;height:687px;border-radius:14px;background:#1A1F29"></div>
  <div style="position:absolute;left:1266px;top:144px;width:324px;height:687px;border-radius:26px;background:#1A1F29"></div>
  <div style="position:absolute;left:1598px;top:144px;width:324px;height:687px;border-radius:26px;background:#1A1F29"></div>
  <div style="position:absolute;left:1272px;top:840px;width:312px;text-align:center;font-size:24px;color:#FF8A3D;font-weight:700">Maya's phone</div>
  <div style="position:absolute;left:1604px;top:840px;width:312px;text-align:center;font-size:24px;color:#B5E48C;font-weight:700">Lily's phone</div>`);
const subs = [];
for (const [i, n] of narr.entries()) {
  if (n.o < TITLE || n.o > TITLE + mainLen) continue;
  const f = await still(`sub-${i}`, `<div style="position:absolute;left:120px;right:120px;top:900px;text-align:center"><span style="display:inline-block;background:rgba(20,24,32,.92);border-radius:14px;padding:14px 26px;font-size:32px;line-height:1.35;color:#F4F1EA">${n.text}</span></div>`, true);
  subs.push({ f, a: n.o - TITLE, b: n.o - TITLE + n.d });
}
await browser.close();

// 5. The main part: frame + TV + phones + subtitles, for each range, then joined.
const parts = [];
for (const [ri, [a, b]] of RANGES.entries()) {
  const out = path.join(WORK, `main-${ri}.mp4`);
  const len = b - a;
  const before = RANGES.slice(0, ri).reduce((s, [x, y]) => s + (y - x), 0);
  const mySubs = subs.filter((s) => s.b > before && s.a < before + len);
  const inputs = ["-loop", "1", "-t", String(len), "-i", framePng,
    "-ss", String(a + tvOffset), "-t", String(len), "-i", path.join(RAW, "tv.mov"),
    // Phones show an empty panel until they open the join link.
    ...["maya", "lily"].flatMap((n) => ["-ss", String(Math.max(0, Math.max(a, tOpen - 0.3) + phoneOffset[n])), "-t", String(len), "-i", path.join(RAW, n + ".webm")]),
    ...mySubs.flatMap((s) => ["-loop", "1", "-t", String(len), "-i", s.f])];
  const pad = (off) => {
    const from = Math.max(a, tOpen - 0.3);
    const d = from - a + Math.max(0, -(from + off));
    return d > 0.01 ? `,tpad=start_duration=${d.toFixed(3)}:color=0x1A1F29` : "";
  };
  let fc = `[1:v]${TVF}fps=30,scale=1200:675,setpts=PTS-STARTPTS[tv];[2:v]fps=30,scale=312:675,setpts=PTS-STARTPTS${pad(phoneOffset.maya)}[m];[3:v]fps=30,scale=312:675,setpts=PTS-STARTPTS${pad(phoneOffset.lily)}[l];` +
    `[0:v][tv]overlay=36:150[v1];[v1][m]overlay=1272:150[v2];[v2][l]overlay=1604:150[v3]`;
  let last = "v3";
  mySubs.forEach((s, i) => {
    const sa = Math.max(0, s.a - before), sb = Math.min(len, s.b - before);
    fc += `;[${last}][${4 + i}:v]overlay=0:0:enable='between(t,${sa.toFixed(2)},${sb.toFixed(2)})'[s${i}]`;
    last = `s${i}`;
  });
  run([...inputs, "-filter_complex", fc, "-map", `[${last}]`, "-t", String(len), "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", out]);
  parts.push(out);
}
const card = (png, len, name) => { const f = path.join(WORK, name + ".mp4"); run(["-loop", "1", "-t", String(len), "-i", png, "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", f]); return f; };
const all = [card(titlePng, TITLE, "title-v"), ...parts, card(endPng, END, "end-v")];
writeFileSync(path.join(WORK, "list.txt"), all.map((f) => `file '${f}'`).join("\n"));
const video = path.join(WORK, "video.mp4");
run(["-f", "concat", "-safe", "0", "-i", path.join(WORK, "list.txt"), "-c", "copy", video]);

// 6. Audio: coach clips (ducked under narration) + narration.
const ain = [...coachClips, ...narr];
const fcA = ain.map((c, i) => `[${i}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${Math.round(c.o * 1000)}|${Math.round(c.o * 1000)}[a${i}]`).join(";") +
  `;${coachClips.map((_, i) => `[a${i}]`).join("")}amix=inputs=${coachClips.length}:normalize=0,volume=0.9,apad[coach]` +
  `;${narr.map((_, i) => `[a${coachClips.length + i}]`).join("")}amix=inputs=${narr.length}:normalize=0,apad,asplit=2[n1][n2]` +
  `;[coach][n1]sidechaincompress=threshold=0.015:ratio=6:attack=15:release=350[duck];[duck][n2]amix=inputs=2:normalize=0,atrim=0:${TOTAL.toFixed(2)}[aout]`;
const audio = path.join(WORK, "audio.m4a");
run([...ain.flatMap((c) => ["-i", c.f]), "-filter_complex", fcA, "-map", "[aout]", "-c:a", "aac", "-b:a", "160k", audio]);
const final = path.join(DIR, "everybody-moves-demo.mp4");
run(["-i", video, "-i", audio, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", final]);
// Gallery stills straight from the TV recording (timeline seconds).
const tJacks = coach.find((c) => /^Jacks!/.test(c.text))?.t;
const tPlank = coach.find((c) => /^Plank!/.test(c.text))?.t;
const STILLS = [["everybody-1-workout-own-versions", tJacks + 3], ["everybody-2-workout-plank", tPlank + 3], ["everybody-3-who-is-in", ev(/^pressed LEFT ENTER$/) - 1.5], ["everybody-4-plan-and-coach", tPlan + 10], ["everybody-5-summary-and-pattern", tSummary + 4]];
// The TV file has frames only up to the last screen change; a static screen after it adds none.
const lastFrame = parseFloat(execFileSync("bash", ["-c", `ffprobe -v error -select_streams v -show_entries frame=pts_time -of csv=p=0 "${path.join(RAW, "tv.mov")}" | sort -n | tail -1`]).toString());
for (let [name, tt] of STILLS) {
  if (tt == null || isNaN(tt)) continue;
  tt = Math.min(tt, lastFrame - tvOffset - 0.05);
  // Seek well before and decode forward: seeking straight to a late moment in screencapture's
  // file can land nowhere.
  const back = Math.min(20, tt + tvOffset);
  // screencapture writes frames only when the screen changes; fps=30 repeats the last one.
  run(["-ss", String(tt + tvOffset - back), "-i", path.join(RAW, "tv.mov"), "-vf", `${TVF}fps=30`, "-ss", String(back), "-frames:v", "1", "-update", "1", path.join(WORK, name + ".png")]);
  if (!existsSync(path.join(WORK, name + ".png"))) throw new Error("still not written: " + name);
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "90", path.join(WORK, name + ".png"), "--out", path.join(process.env.HOME, "money-10x/submissions/images", name + ".jpg")], { stdio: "ignore" });
}
const tJacksOut = toOut(tLive + 6) ?? toOut(tPlank + 4);
if (tJacksOut != null) {
  run(["-ss", String(tJacksOut), "-i", final, "-frames:v", "1", "-update", "1", path.join(WORK, "composite.png")]);
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "90", path.join(WORK, "composite.png"), "--out", path.join(process.env.HOME, "money-10x/submissions/images", "everybody-6-tv-and-phones.jpg")], { stdio: "ignore" });
}
console.log("done", final, dur(final).toFixed(1), "s");
