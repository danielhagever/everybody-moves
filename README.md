# Everybody Moves

**One family workout on Fire TV, where each person gets their own version of every move.**

Family workouts fall apart because one video can't fit everyone. Grandpa can't jump, Mom's knee hurts today, and the teenager is bored by minute three. Everybody Moves puts the whole household in one session on the TV. Everyone checks in from their phone, and the coach gives each person the right version of each move: a seated march for sore knees, a chair squat for Grandpa, jump squats for whoever said "easy" twice. The moves line up, so the family still works out together.

Built for Fire TV on **Vega OS** with React Native for Vega. Shown here on the **Vega Virtual Device**.

- **Demo video (2:45):** https://youtu.be/AeWlXk4QVJo
- **Phone check-in page (works on any phone):** `https://everybody-moves.meshulam791.workers.dev/j/<ROOM>` (the TV shows the code and a QR code)
- **Service:** https://everybody-moves.meshulam791.workers.dev

## What it does

| Step | On the TV (remote) | On each phone |
|---|---|---|
| Home | The household, everyone's level, the last 7 days, and what the coach noticed | |
| Who's working out? | A QR code and a room code. Members join from a phone, or with the remote | Pick your name, rate your energy 1 to 5, mark anything sore (knees, back, shoulders, wrists) |
| Today's plan | Length, focus, the coach's spoken introduction, and every person's version of each move | "Your versions": your own list |
| Workout | A demonstrating figure, a countdown ring, and one row per person with their version, cue, and reason ("easy on the knees"). The coach calls out only the differences | Your current move, your cue, the same synced timer, and captions of what the coach just said |
| Afterwards | "How did that feel?" for everyone; answer with the remote or on a phone | Easy, Just right, or Hard |
| Next time | Who levels up or down, and what the household's pattern says about the next session | Your own change |

Remote: OK on the focused button; **play/pause** pauses the session; **fast-forward / rewind** skip blocks (a skipped exercise doesn't count as finished); **back** pauses during a workout and steps back elsewhere (it never skips the ratings). **End** (press it twice: the first press asks) stops the session for everyone: the phones move to the rating screen too, and only the work blocks actually finished are counted.

If the coach's voice can't play (for example when the free daily allowance for the voice model runs out), the TV still shows the line and every phone still gets the caption. Someone who joins after the plan was made follows the figure on the TV, and the phone says why.

## How it adapts

The plan is computed on the server, deterministically, so the TV and every phone agree on it ([`cloud/src/plan.ts`](cloud/src/plan.ts)):

- **Per person, per move:** level 1 to 3 picks the variation; energy 1 or 2 drops one level for today; "no jumping" members never get a jumping version. Every move lists the areas it loads (knees, back, shoulders, wrists), and every substitute lists the areas it spares: if a move loads something sore, the person gets a substitute that spares *all* their sore areas, or sits that move out with easy breathing when none does.
- **Per household:** the focus (legs, upper body, core) is whatever the household trained least recently. The length comes from the household's own history at this time of day: if most recent sessions around this hour ended early, today is 8 minutes; if every one was finished, 15.
- **After each session:** "hard" lowers that person's level; "easy" twice in a row raises it.

The coach's introduction is phrased by a language model (Llama 4 Scout on Workers AI) from those facts only. The service rejects a reply, and uses a template instead, if it adds a number the plan doesn't contain (in digits or words), names anyone who isn't in the household, leaves someone out, guesses anyone's pronouns, says "longer" about a shortened session (or the reverse), talks about anyone's pace (everyone shares one timer; only the version changes), runs long, or takes more than 8 seconds ([`cloud/src/coach.ts`](cloud/src/coach.ts)). Four of those rules come from replies the model actually gave during testing: an invented family member ("Alex and Sam will get gentler versions"), a guessed pronoun, a reversed reason ("ended early, so we need a bit more time"), and a pace change that doesn't exist ("a gentler pace since you're low on energy"). The tests include them.

## Vega and Fire TV specifics

- **React Native for Vega** (`@amazon-devices/react-native-kepler` 4.0, React Native 0.83), built with the Vega CLI from the `helloWorld` template.
- **TV focus and remote:** focusable `Pressable`s with `hasTVPreferredFocus`, `useTVEventHandler` for play/pause and skip, and `BackHandler` so back never drops you out of a session.
- **Coach voice:** `AudioPlayer` from `@amazon-devices/react-native-w3cmedia` (the Vega W3C media stack) streams each line as MP3; the manifest declares the audio and media services it needs.
- **Graphics:** `@amazon-devices/react-native-svg` draws the exercise figures (key poses blended in code, no video or image assets), the countdown ring, and the QR code (matrix from `qrcode-generator`).
- **10-foot UI:** layouts are designed on a 1920 x 1080 canvas and scaled to Vega's 960 x 540 layout units.

## Architecture

```
Fire TV app (Vega, React Native)  ──HTTPS──>  Cloudflare Worker (cloud/)
  screens, focus, remote, audio              planner, sessions, check-ins, ratings
                                              D1: households, members, sessions, presence, coach lines
Phones (web page, no install)  ──HTTPS──>     Workers AI: Llama 4 Scout (coach intro), Deepgram Aura-2 (voice)
```

The TV, the service, and the phones all compute "where are we in the session" from the same start time, pauses, and skips, so a phone that joins late shows the same second as the TV.

## Run it

**TV app** (needs the [Vega SDK](https://developer.amazon.com/docs/vega/latest/install-vega-sdk.html)):

```bash
cd tv
npm install
npm run build:debug
vega virtual-device start
vega run-app build/aarch64-debug/everybodymoves_aarch64.vpkg com.glitchbound.everybodymoves.main -d VirtualDevice
```

Use `build/x86_64-debug/...` on an Intel Mac. The app talks to the hosted service, so nothing else is needed to try it. On launch it opens a fresh sample household (the Parkers, with two weeks of history). On the "Who's working out?" screen, set **Pace: demo (5x)** to run a whole session in about two minutes.

**Service** (optional, to host your own; Cloudflare's free plan is enough):

```bash
cd cloud
npm install
npx wrangler d1 create everybody-moves      # put the id in wrangler.jsonc
npx wrangler d1 execute everybody-moves --remote --file=schema.sql
npx wrangler deploy
npm test                                   # 29 tests: planner, sore-area rules, skips, coach rules
```

Then change `BASE` in `tv/src/api.ts`.

## Layout

```
tv/src/App.tsx              screens, session polling, remote handling, coach cues
tv/src/screens/             Home, Lobby (who's in), PlanScreen, Workout, Rate + Summary
tv/src/ui/Figure.tsx        exercise figures (react-native-svg)
tv/src/ui/kit.tsx           focus buttons, QR code, countdown ring, 10-foot scale
tv/src/voice.ts             coach voice (W3C media AudioPlayer)
tv/src/cues.ts              what the coach says at each block
tv/test/                    6 unit tests (cues, introduction sentences, session clock): npx jest
cloud/src/plan.ts           the planner (per person, per household, after each session)
cloud/src/coach.ts          AI introduction with guardrails
cloud/src/index.ts          API, sample household, sessions
cloud/public/phone.html     phone check-in, personal view, captions, rating
scripts/                    run on the virtual device, press remote keys, screenshots, coach sample, video tooling
```

## Limits, honestly

- Shown on the Vega Virtual Device; not yet tested on a Fire TV stick.
- Each launch starts a fresh sample household: the React Native for Vega profile used here has no simple key-value storage (see FRICTION_LOG.md). The household's history and levels live in the service.
- The coach's voice runs on Workers AI's free daily allowance. If it runs out, the TV still shows each line and the phones still get captions. The voice endpoint only answers for a room opened in the last 12 hours.
- Check-ins are shown on the TV (energy, sore spots), because the plan is shared; nothing is kept beyond the household's sessions.
- It's general fitness guidance, not medical advice; the "sore" option only swaps in gentler moves.

## License

MIT. See [LICENSE](LICENSE).
