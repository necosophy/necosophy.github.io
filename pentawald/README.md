# Pentawald

A browser-based MIDI field recorder that runs entirely offline on a phone. Plug in
any class-compliant USB MIDI device, monitor it through a built-in synth, watch
it as an abstract visual, and export a standard `.mid` file — no app store, no
account, no server.

Built for capturing biofeedback MIDI from a [Pocket SCÍON](https://www.instrumentsofthings.com/)
attached to plants and fermentation cultures, in a garden with no laptop and no
signal.

**Live:** https://necosophy.github.io/pentawald/

## Requirements

- **An Android phone with Chrome.** This is the only fully-supported
  configuration — Chrome on Android has mature Web MIDI support and is what
  this app is built and tested against.
- **A USB-OTG adapter** to connect a class-compliant USB MIDI device to the
  phone's charging port.
- **iOS is unsupported.** Safari on iOS does not implement the Web MIDI API at
  all, so the app cannot see a connected device there. This was confirmed
  during development, not assumed — there is no code path that will make MIDI
  input work on iOS today. Everything else (offline loading, the synth, the
  visualizer) would work on iOS Safari if it ever gains Web MIDI support; only
  the input side is blocked.

## Using it

1. Open the link above in Chrome on Android and grant MIDI access when
   prompted.
2. Connect your MIDI device. The status bar at the top shows its name once
   connected — tap it any time to rescan.
3. Notes and CC arrive in the live feed as confirmation the connection is
   working, whether or not you're recording.
4. Tap **Record** to start a take. Timing is captured at real millisecond
   resolution — nothing is quantized. The screen is kept awake for the
   duration.
5. Tap the marker buttons (or the free-text one) any time during a take to
   stamp an annotation at that exact instant. They show up in the exported
   file as markers on your DAW's timeline.
6. Tap **Record** again to stop. Name the file, then **Export .mid** — this
   tries the device's native share sheet first (e.g. to send straight to
   Signal or Files) and falls back to a normal download if sharing isn't
   available.
7. The synth panel (pad / bell / noise presets, mute) is just for monitoring
   what's coming in — muting or adjusting it never affects what gets
   recorded.

## Installing to the home screen

- **Android/Chrome:** use Chrome's own "Install app" / "Add to Home Screen"
  prompt. Once installed it opens as a standalone app and works fully offline
  — everything it needs (fonts, icons, the app itself) is cached on first
  load.
- **iOS Safari:** Share menu → "Add to Home Screen." This gets you the icon
  and a chrome-less launch, but MIDI input still won't work there — see
  Requirements above.

## Technical notes

- Vanilla HTML/CSS/JS, no build step, no framework, no external runtime
  dependencies. The one bundled asset — the Julius Sans One display font used
  for the wordmark — is a local `.woff2` file under `fonts/` with its OFL
  license, not a CDN reference.
- MIDI files are written by hand in-browser (a from-scratch Standard MIDI
  File Type 1 encoder): 960 ticks/quarter note at a fixed 120 BPM, one track
  per channel that received data, marker meta-events on the tempo track.
  Verified against an independent parser (`mido`) during development.
- A service worker (`sw.js`) pre-caches the app shell for offline use;
  bumping `CACHE_NAME` in that file forces clients to pick up a fresh copy on
  next load.

## License

Code in this directory has no separate license file — it inherits whatever
applies to the rest of this repository. The bundled font
(`fonts/JuliusSansOne-Regular.woff2`) is licensed separately under the SIL
Open Font License; see `fonts/OFL.txt`.
