// Records the Everybody Moves demo: the real app on the Vega Virtual Device (screen capture of
// the simulator window), two phones checking in (headless Chrome, recorded by Playwright), and
// remote presses through inputd-cli, all on one timeline. Writes raw/ with timestamps; the
// edit (narration, coach audio, layout) is done by edit-everybody.mjs.
import { chromium } from "playwright-core";
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, readdirSync, renameSync } from "node:fs";
import path from "node:path";

const BASE = "https://everybody-moves.meshulam791.workers.dev";
const OUT = new URL("./out/everybody/raw/", import.meta.url).pathname;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const VEGA = path.join(process.env.HOME, "vega/bin/vega");
const env = { ...process.env, PATH: `${path.join(process.env.HOME, "vega/bin")}:${process.env.PATH}` };
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
const log = [];
let T0 = 0;
const t = () => (Date.now() - T0) / 1000;
const mark = (what) => { log.push({ t: t(), what }); console.log(t().toFixed(1).padStart(6), what); };

// Remote presses: one device command can carry several keys.
function press(...keys) {
  const cmd = keys.map((k) => `inputd-cli button_press KEY_${k}`).join("; sleep 0.35; ");
  return new Promise((res) => {
    const p = spawn(VEGA, ["device", "run-cmd", "-d", "VirtualDevice", "-c", cmd], { env, stdio: "ignore" });
    p.on("exit", () => { mark("pressed " + keys.join(" ")); res(); });
  });
}

// 1. Restart the app so it opens on a fresh sample household, and bring the simulator forward.
const vpkg = new URL("../everybody-moves/tv/build/aarch64-debug/everybodymoves_aarch64.vpkg", import.meta.url).pathname;
try { execFileSync(VEGA, ["device", "run-cmd", "-d", "VirtualDevice", "-c", "vlcm terminate-app --pkg-id com.glitchbound.everybodymoves --force"], { env, stdio: "ignore" }); } catch {}
await sleep(2);
execFileSync(VEGA, ["run-app", vpkg, "com.glitchbound.everybodymoves.main", "-d", "VirtualDevice"], { env, stdio: "ignore" });
execFileSync("osascript", ["-e", 'tell application "System Events" to set frontmost of (first process whose name contains "vega-virtual-device") to true']);
await sleep(7);

// 2. The simulator's window id. The recording is of that window only (-l, -o: no shadow), which
// keeps working when the screen saver is up; the TV picture is the window minus its 28 pt title bar.
const winId = execFileSync("swift", ["-e", `import CoreGraphics
let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]
for w in list where (w[kCGWindowOwnerName as String] as? String ?? "").contains("vega-virtual-device") && ((w[kCGWindowLayer as String] as? Int) ?? 1) == 0 { print(w[kCGWindowNumber as String]!); break }`]).toString().trim();
const tv = { crop: "1912:1076:4:58" }; // inside the 2320 x 1136 window video
console.log("window", winId);

// 3. Phones: two headless Chrome pages, each recorded.
const browser = await chromium.launch({ channel: "chrome", headless: true });
const phone = async (name) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, recordVideo: { dir: path.join(OUT, name), size: { width: 390, height: 844 } } });
  const page = await ctx.newPage();
  const created = Date.now(); // the page's video starts here
  await page.goto("about:blank");
  return { ctx, page, name, created };
};
const maya = await phone("maya");
const lily = await phone("lily");

// 4. Screen video of just the TV area (macOS screencapture; ffmpeg's screen device hangs on this
// macOS). The edit finds the exact start by matching the first screen change to the first press.
// screencapture only saves a video when its own time limit ends (a signal discards it), so it
// gets a fixed length that covers the whole timeline (about 160 s).
const CAPTURE_SECONDS = 185;
const ff = spawn("screencapture", ["-x", "-o", "-v", "-V", String(CAPTURE_SECONDS), "-l", winId, path.join(OUT, "tv.mov")], { stdio: "ignore" });
await sleep(1.0);
T0 = Date.now();
mark("capture started");

const tap = async (p, selector, label) => { await p.page.locator(selector).first().click(); mark(`${p.name} taps ${label}`); };

// 5. The timeline.
await sleep(6);
await press("ENTER"); // Home -> lobby (creates the room)
await sleep(2.5);
const code = JSON.parse(execFileSync("npx", ["wrangler", "d1", "execute", "everybody-moves", "--remote", "--json", "--command", "SELECT code FROM sessions ORDER BY created_at DESC LIMIT 1"], { cwd: new URL("../everybody-moves/cloud/", import.meta.url).pathname }).toString())[0].results[0].code;
mark("room " + code);
await Promise.all([maya.page.goto(`${BASE}/j/${code}`), lily.page.goto(`${BASE}/j/${code}`)]);
mark("phones open the join link");
await sleep(1.5);
const pick = async (p, who) => tap(p, `button.who:has-text("${who}")`, who);
await pick(maya, "Maya");
await sleep(1.2);
await pick(lily, "Lily");
await sleep(1.2);
await tap(maya, 'button[data-e="3"]', "energy 3");
await sleep(1.0);
await tap(maya, 'button[data-s="knees"]', "sore knees");
await sleep(0.8);
await tap(lily, 'button[data-e="5"]', "energy 5");
await sleep(1.0);
await tap(maya, "#go", "I'm in");
await sleep(0.8);
await tap(lily, "#go", "I'm in");
await sleep(1.5);
await press("DOWN", "ENTER"); // Ben joins without a phone
await sleep(0.8);
await press("DOWN", "DOWN", "ENTER"); // Grandpa Joe too
await sleep(1.0);
await press("DOWN", "RIGHT", "ENTER"); // demo pace
await sleep(0.6);
await press("LEFT", "ENTER"); // build our plan
// Plan screen: wait for the coach's introduction to finish.
const waitFor = async (pred, max = 60) => { const end = Date.now() + max * 1000; while (Date.now() < end) { const s = await (await fetch(`${BASE}/api/session/${code}`)).json(); if (pred(s)) return s; await sleep(0.5); } };
const ready = await waitFor((s) => s.status === "ready");
mark("plan ready");
// Let the coach finish the introduction (Start stops it), plus room for one narration line.
const introMp3 = path.join(OUT, "intro.mp3");
writeFileSync(introMp3, Buffer.from(await (await fetch(`${BASE}/api/tts?s=${code}&t=${encodeURIComponent(ready.coach.text)}`)).arrayBuffer()));
const introLen = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", introMp3]).toString());
mark(`coach introduction is ${introLen.toFixed(1)} s`);
await sleep(Math.max(12, introLen + 1 + 7));
await press("ENTER"); // Start
await waitFor((s) => s.status === "live");
mark("workout live");
await sleep(44); // warm-up, then the first work blocks at demo pace
await press("RIGHT", "ENTER"); // Skip
await sleep(1.5);
await press("ENTER");
await sleep(1.5);
await press("ENTER");
await sleep(1.5);
await press("ENTER");
mark("skipped ahead");
await waitFor((s) => s.position?.done, 90);
mark("session over");
await sleep(3);
await tap(maya, 'button[data-r="right"]', "just right");
await sleep(1.2);
await tap(lily, 'button[data-r="easy"]', "easy");
await sleep(1.5);
await press("DOWN", "ENTER"); // Ben: just right
await sleep(0.8);
await press("DOWN", "DOWN", "ENTER"); // Grandpa Joe: just right
await sleep(1.2);
await press("DOWN", "ENTER"); // see what changes
await waitFor((s) => s.status === "done");
mark("summary");
await sleep(12);
mark("end");

// 6. Stop and save.
console.log(`waiting for the screen recording to end (${(CAPTURE_SECONDS - t()).toFixed(0)} s)`);
await new Promise((r) => (ff.exitCode !== null ? r() : ff.on("exit", r)));
const vids = {};
for (const p of [maya, lily]) {
  const v = p.page.video();
  await p.ctx.close();
  const f = await v.path();
  renameSync(f, path.join(OUT, `${p.name}.webm`));
}
await browser.close();
let lines = [];
for (let i = 0; i < 5; i++) { try { lines = await (await fetch(`${BASE}/api/session/${code}/lines`)).json(); break; } catch { await sleep(3); } }
writeFileSync(path.join(OUT, "timeline.json"), JSON.stringify({ T0, code, tv, log, lines, phoneStart: { maya: (maya.created - T0) / 1000, lily: (lily.created - T0) / 1000 } }, null, 2));
console.log("saved", OUT);
