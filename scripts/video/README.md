# Demo video tooling

How the demo video was made: `record-everybody.mjs` drives the app on the Vega Virtual Device (remote presses through `inputd-cli`), records the simulator window and two phone-sized browsers, and logs every line the coach spoke; `edit-everybody.mjs` lays them out, places the coach's real audio where the TV played it, and adds narration and subtitles.

They ran from a sibling `videotools/` folder that holds the local narration voice (Kokoro) and Playwright, so they are kept here for transparency rather than as a turnkey script.
