# Triwald

An offline, browser-based ambient instrument that turns three phone sensors into
three live musical voices — no app store, no account, no server, and no MIDI
hardware required.

**Live:** https://necosophy.github.io/triwald/

## The three voices

| Sensor | Voice | Character |
| --- | --- | --- |
| Ambient light (camera) | Bass | Slow, sustained, smoothed — scale-quantized |
| Microphone | Lead | Pitch/amplitude-tracked, monophonic, the most reactive voice — scale-quantized |
| Motion (accelerometer) | Percussion | Unscaled, irregular/polyrhythmic hits, synthesized woody timbres |

Each voice is independently monophonic (one note at a time), but all three run
simultaneously and layer freely — toggle any combination on or off with the tap
targets at the top of the screen. The bass and lead share one scale, switchable
from the dropdown (F minor by default); percussion deliberately ignores the
scale entirely.

## Requirements

- **An Android phone with Chrome**, the primary target and what this app is
  built against — camera, microphone, and motion sensor access, plus a
  reasonably fast pitch-detection loop, all need a modern mobile Chromium build.
- **HTTPS** (satisfied automatically by the `github.io` link above) — camera,
  microphone, and motion access are all gated behind a secure context and an
  explicit tap.
- No camera/mic/motion hardware, or a denied permission, simply leaves that
  one voice unavailable; the other two still work.

## Using it

1. Open the link above in Chrome on Android.
2. Tap **Light → Bass**, **Mic → Lead**, and/or **Motion → Percussion** to turn
   on any combination of voices — each prompts for its own permission the
   first time.
3. Pick a scale (root + mode) from the dropdown; it retunes the bass and lead
   voices immediately, live.
4. Watch the three-zone visualizer (left = bass, middle = lead, right =
   percussion) — a continuous level bar shows the raw sensor signal, and
   particle bursts mark each actual note or hit.
5. Tap **Record** to start capturing a take at real millisecond resolution.
   Tap it again to stop, name the file, then export.
6. **Export .mid** writes a 3-track Standard MIDI File (bass on channel 1,
   lead on channel 2, percussion on channel 10 using GM drum note numbers) from
   the exact same note/timing data the voices played live. **Export audio**
   re-renders that same data offline through the same synth engine and
   downloads it as a `.wav`. Both try the device's native share sheet first
   and fall back to a normal download.

## Technical notes

- Vanilla HTML/CSS/JS, no build step, no framework — same approach as its
  sibling project [Pentawald](../pentawald/), whose visual design and
  visualizer this app deliberately mirrors (the visualizer module is a direct
  three-zone extension of Pentawald's particle system).
- **No Web MIDI API dependency anywhere** — recording is built on an internal
  note/timing event list (timestamp, channel, note, velocity) that both the
  live synth and both export formats read from. This is what makes iOS-safe
  playback and MIDI export possible without Web MIDI, which iOS/Safari never
  implements.
- **Light → Bass**: the camera frame is downsampled to 8×8 and averaged for
  perceptual luminance, exponentially smoothed, then mapped to a scale degree
  with hysteresis (a candidate note must hold for ~0.9s) and a minimum hold
  time (~1.8s) before the bass voice actually changes pitch — this is what
  keeps it slow-moving rather than flickering with every camera frame.
- **Mic → Lead**: a from-scratch autocorrelation pitch detector (bounded to a
  70–1200 Hz lag range so it stays cheap on old hardware) with a first-strong-peak
  search rather than a global-max search, specifically to avoid picking an
  octave-down subharmonic instead of the true fundamental. Detected pitch is
  quantized to the nearest note in the active scale; amplitude drives velocity
  and note-on/off gating.
- **Motion → Percussion**: acceleration magnitude is compared against an
  adaptive noise floor to detect peaks (not a fixed threshold), each of which
  fires one hit immediately. A sufficiently strong peak also schedules a short
  grace-note roll using an evenly-distributed Euclidean rhythm (alternating
  3-in-8 and 5-in-12 groupings — a 3:2 / 5:4 feel) with humanized timing,
  rather than quantizing to any grid. All three percussion timbres (wood
  block, clave, shaker) are synthesized from filtered noise bursts and short
  tone partials — no samples.
- A service worker (`sw.js`) pre-caches the app shell for fully offline use,
  same pattern as Pentawald.

## Development note

This app was built and syntax/logic-verified (MIDI file structure, WAV header
math, scale generation, and the pitch detector's accuracy against synthetic
tones) in an environment without a physical Android device attached. **It has
not yet been hand-tested on real hardware** — the constants tuned here
(smoothing rates, thresholds, envelope times) are a first-pass calibration and
will likely need adjustment once tried against a real camera, mic, and
accelerometer in the field.

## License

Code in this directory has no separate license file — it inherits whatever
applies to the rest of this repository. The bundled font
(`fonts/JuliusSansOne-Regular.woff2`) is licensed separately under the SIL
Open Font License; see `fonts/OFL.txt`.
