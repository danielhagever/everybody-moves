# Friction log

Each entry: the task, the steps, what I expected, what happened, severity, the workaround, and a suggestion.
Severity: high = blocked progress, medium = cost real time, low = annoyance.
Setup: Vega SDK 0.24.12112, Vega CLI 1.4.2, `helloWorld` template (React Native 0.83, OS version 1.2), Vega Virtual Device on an 8 GB M2 MacBook Air, macOS 26.

## 1. Following the QR-code library's install note broke the build command
- **Task:** Show a QR code on the TV so phones can join the session.
- **Steps:** Followed the `react-native-qrcode-svg` page, which says to add `legacy-peer-deps=true` to `.npmrc`, then ran `npm install` and `npm run build:debug`.
- **Expected:** The app builds as before.
- **Actual:** `error: unknown command 'build-vega'`. With `legacy-peer-deps`, npm stops installing peer dependencies, and `@amazon-devices/kepler-cli-platform` lists `@react-native-community/cli-tools` only as a peer, so the CLI plugin silently failed to load.
- **Severity:** medium
- **Workaround:** Removed `.npmrc` and drew the QR code myself: `qrcode-generator` (pure JS) for the matrix, `@amazon-devices/react-native-svg` for the drawing.
- **Suggestion:** Make `cli-tools` a regular dependency of `kepler-cli-platform`, or have the CLI print "Vega CLI plugin failed to load: missing @react-native-community/cli-tools" instead of "unknown command".

## 2. Libraries listed for React Native 0.83 are not in the 0.83 profile
- **Task:** Add the QR-code, async-storage and linear-gradient libraries.
- **Steps:** The docs give React Native 0.83 versions (`@amazon-devices/react-native-qrcode-svg ~3.0.0`, and so on). Ran `vega project install <package>`.
- **Expected:** The package is added.
- **Actual:** `not in OS version 1.2 profile, skipping` / `not found in OS Version 1.2 + RN 0.83 profile` for `react-native-qrcode-svg`, `react-native-async-storage`, `react-native-mmkv` and `react-native-linear-gradient`.
- **Severity:** medium
- **Workaround:** QR code as above; no local key-value storage (see 3).
- **Suggestion:** Mark each library page with the OS-version profiles it ships in, the same data `vega project install` already uses.

## 3. No simple way to remember one value on the device
- **Task:** Remember which household this TV belongs to.
- **Steps:** Tried async-storage and MMKV (not in profile), `expo-file-system` (its Vega readme also requires `expo ~50`), and `react-native-device-info` `getUniqueId` (its source lists only android, ios and windows as supported platforms).
- **Expected:** One of the usual React Native options for persisting a small value.
- **Actual:** None worked without pulling in Expo.
- **Severity:** medium
- **Workaround:** The app opens on a fresh sample household each launch, which also makes the demo repeatable; the household's history lives on the server.
- **Suggestion:** Ship async-storage (or MMKV) in the current profile, or document the recommended Vega way to store a few bytes.

## 4. Layout units are half the screen's pixels, and nothing says so
- **Task:** Lay out a 10-foot UI for a 1080p TV.
- **Steps:** Designed at 1920 x 1080 and built.
- **Expected:** 1920 x 1080 layout units, or a note in the template.
- **Actual:** Everything rendered at twice the intended size: the window is 960 x 540 units on a 1080p screen.
- **Severity:** low
- **Workaround:** One scale function, `u(n) = n * width / 1920`, applied to every size.
- **Suggestion:** Say it in the hello-world tutorial and the template (a comment next to the tile size would do).

## 5. The documented screenshot command hung on the virtual device
- **Task:** Take screenshots of the app for checking layouts.
- **Steps:** `vega exec vda shell gwsi-tool-screenshooter /tmp/test.png`, as documented on the VDA tools page; later also `vega device run-cmd -c "gwsi-tool-screenshooter /tmp/s1.png"` with developer mode enabled.
- **Expected:** A PNG on the device.
- **Actual:** No output either way; still running after a minute or two.
- **Severity:** low
- **Workaround:** macOS window capture of the simulator window (`screencapture -l <window id>`).
- **Suggestion:** A `vega device screenshot` command that works on the virtual device and copies the file back.

## 6. Scripted remote presses are slow
- **Task:** Drive the app from a script (for testing and for recording the demo).
- **Steps:** Enabled developer mode (`vsm developer-mode enable`), then `vega device run-cmd -c "inputd-cli button_press KEY_ENTER"`.
- **Expected:** Near-instant presses.
- **Actual:** Each `run-cmd` takes about 2 seconds, so a "down, down, OK" sequence takes 6.
- **Severity:** low
- **Workaround:** Several presses in one command (`inputd-cli button_press KEY_DOWN; sleep 0.35; inputd-cli button_press KEY_ENTER`).
- **Suggestion:** `vega device press DOWN DOWN ENTER`, or a persistent input connection from the CLI.

## 7. An SVG element removed between renders stays on screen
- **Task:** Draw a chair behind the seated-march figure only while that move is shown.
- **Steps:** Rendered `{prop === 'chair' ? <G>...</G> : null}` inside an `@amazon-devices/react-native-svg` `Svg`, then moved to the next block (plank).
- **Expected:** The chair disappears with the move.
- **Actual:** The chair lines stayed on screen behind the plank figure for the rest of the session (seen in recordings from the Vega Virtual Device).
- **Severity:** medium (a visible glitch that's easy to miss)
- **Workaround:** Always render the chair and the wall, and set `opacity` to 0 when unused, so the SVG tree never loses elements.
- **Suggestion:** Check child removal in the Vega SVG renderer; until then, a note on the library page.

## 8. The remote-event type names keys that never arrive
- **Task:** Skip blocks with the remote's fast-forward and rewind buttons.
- **Steps:** Read `HWEvent` in `@amazon-devices/react-native-kepler` (`Libraries/TV/TVTypes.d.ts`): its `eventType` union includes `'skip_forward'` and `'skip_backward'`, while the comment above it lists `forward` and `rewind`. Tested on the Vega Virtual Device with builds that accepted only one name at a time, pressing `KEY_FASTFORWARD` and `KEY_REWIND` through `inputd-cli`.
- **Expected:** The typed names work.
- **Actual:** A handler for `'skip_forward'` / `'skip_backward'` never fired. The events arrive as `'forward'` and `'rewind'`, which the union doesn't contain (it accepts them only through its trailing `string`).
- **Severity:** medium (a handler written from the type silently does nothing)
- **Workaround:** Accept both spellings.
- **Suggestion:** Add `'forward'` and `'rewind'` to the union, or say which names each device sends.

## What worked well (for balance)
- The installer ran unattended (`NONINTERACTIVE=true`), and the virtual device booted in about 35 seconds using about 600 MB on an 8 GB laptop.
- `AudioPlayer` from `@amazon-devices/react-native-w3cmedia` streamed MP3 from a URL on the first try.
- `vega project install` resolving OS-compatible versions is a good idea; it caught the profile problem before build time.
- `useTVEventHandler` and `BackHandler` made remote handling (play/pause, skip, back) straightforward.
