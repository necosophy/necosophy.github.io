# Triwald

An offline, browser-based ambient instrument that turns three phone sensors into
three live musical voices — no app store, no account, no server, and no MIDI
hardware required.

**Live:** https://necosophy.github.io/triwald/

## The three voices

| Sensor | Voice | Character |
| --- | --- | --- |
| Ambient light (camera) | Bass | Soft ambient pad with a reverb wash, slow attack/release — scale-quantized |
| Microphone | Lead | Pitch/amplitude-tracked, monophonic, the most reactive voice — scale-quantized |
| Motion (accelerometer + gyroscope) | Percussion | Unscaled, irregular/polyrhythmic hits, synthesized woody timbres |

Motion uses only the phone's accelerometer and gyroscope (both delivered by
the same `devicemotion` event) — it does not use, request, or need GPS/location
at all.

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
  keeps it slow-moving rather than flickering with every camera frame. The
  voice itself is a soft ambient pad (two gently detuned triangle
  oscillators, a slow-breathing lowpass filter, a synthesized-impulse
  reverb send) rather than a punchy low tone. A retrigger (light moving to a
  new note while still enabled) cuts the previous note fast; only an actual
  note-off (the voice being switched off) gets the long ~1.6s release into
  the reverb tail — so quick successive notes never pile up into an
  overlapping wash.
- **Mic → Lead**: a from-scratch autocorrelation pitch detector (bounded to a
  70–1200 Hz lag range so it stays cheap on old hardware) with a first-strong-peak
  search rather than a global-max search, specifically to avoid picking an
  octave-down subharmonic instead of the true fundamental. Detected pitch is
  quantized to the nearest note in the active scale; amplitude drives velocity
  and note-on/off gating.
- **Motion → Percussion**: linear acceleration magnitude *and* gyroscope
  rotation-rate magnitude are combined into one motion-energy signal (a still
  phone rotated gently produces almost no accelerometer signal but a clear
  rotation-rate one, so folding both in is what makes small in-hand tilts and
  twists register, not just literal shakes). That combined signal is compared
  against an adaptive noise floor to detect peaks (not a fixed threshold),
  each of which fires one hit immediately. A sufficiently strong peak also
  schedules a short grace-note roll using an evenly-distributed Euclidean
  rhythm (alternating 3-in-8 and 5-in-12 groupings — a 3:2 / 5:4 feel) with
  humanized timing, rather than quantizing to any grid. All three percussion
  timbres (wood block, clave, shaker) are synthesized from filtered noise
  bursts and short tone partials — no samples.
- A service worker (`sw.js`) pre-caches the app shell for fully offline use,
  same pattern as Pentawald.

## Development / calibration notes

This app was built without a physical Android device attached, so the
constants tuned here (smoothing rates, thresholds, envelope times) are a
best-effort calibration rather than something hand-tested in the field.
Three rounds of on-device feedback have gone into fixes so far:

- **Bass register raised twice** (C2–G3 → C3–G4 → now C4–G5, overlapping the
  bottom of the lead's own range) **and switched from sine/triangle
  oscillators to sawtooth.** A phone speaker can't move enough air below
  ~200–300Hz to make a genuinely low register audible at any volume; the
  sawtooth's rich harmonics also matter as much as the register change, since
  they put real energy into the 500Hz–2kHz band the speaker actually
  projects (a raw low fundamental plays back very weakly even once it's
  nominally "in range"). The voice is told apart from the lead by its slow
  attack and warmer filtering, not by occupying a lower pitch range anymore.
- **The mic's noise floor now adapts continuously**, not only while gated
  closed, with separate onset/hold thresholds (a Schmitt trigger). Previously,
  a room whose ambient/self-noise sat above the fixed gate threshold (the mic
  stream deliberately disables echoCancellation/noiseSuppression/AGC, for
  cleaner pitch tracking) left the floor stuck too low to ever close the gate,
  so the lead voice could hold a phantom tone through real silence.
- **Percussion's motion detection was made more robust, not just more
  sensitive.** It previously trusted `event.acceleration` (gravity already
  removed) when a device offered it, falling back to computing that removal
  itself only otherwise. `event.acceleration` depends on the OS/browser doing
  its own sensor fusion, which is exactly the kind of feature that's flaky or
  absent on older/cheaper Android phones — this app's actual target hardware
  — so gravity removal is now always done in-app from
  `accelerationIncludingGravity` alone, which needs only a basic
  accelerometer. Thresholds were also lowered substantially again and the
  gyroscope's contribution to the combined motion signal was increased, and
  the hits themselves are louder and a touch longer for a tiny speaker's
  limited excursion/efficiency. If percussion is still silent after this, the
  most likely remaining cause is `devicemotion` not firing at all on that
  device/browser rather than a threshold still being too high — the
  percussion zone's level bar in the visualizer reacts to raw motion
  continuously (not just on a triggered hit), so waving the phone while
  watching that bar is the fastest way to tell which case it is.

- **Every synthesized note/hit now disconnects its audio nodes once it
  finishes**, which it previously didn't. This is the likely root cause of
  "sound stops entirely after a few seconds of moving the phone" reported on
  an iPhone 15 Pro: leaving stopped-but-still-connected nodes in the graph is
  a known way to make Safari/WebKit's Web Audio implementation degrade and
  eventually go silent once enough of them accumulate, and percussion in
  particular can fire many hits per second under continuous motion. Every
  voice (bass, lead, percussion) now attaches an `onended` handler that
  disconnects all of that note's nodes, and the bass voice's own retrigger
  path was fixed to actually take the fast-cutoff branch it was supposed to
  (it previously always went through the slow release first, so the fast
  path was unreachable dead code).
- **Mic sensitivity raised substantially** — the fixed absolute noise-gate
  floor (independent of the adaptive one) was set high enough that it
  dominated in any normal quiet-ish room, which is what made it need
  something close to shouting to trigger. Lowered by more than 3x, with the
  onset/hold multipliers rebalanced to match; simulated against the same
  persistent-noise scenario as the previous phantom-tone fix to confirm it
  still gates closed in silence.
- **Motion thresholds lowered further** in general, on top of the
  accelerometer-only robustness fix from the previous round. Separately: a
  phone with no gyroscope hardware (reported on an older Android device)
  simply gets `rotationRate: null` from `devicemotion`, which this app
  already handles gracefully by falling back to accelerometer magnitude
  alone — expected behavior, not a bug, though it does mean percussion on a
  gyroscope-less phone responds only to real shakes, not gentle tilts.

Given the wide range of phone speakers, mic hardware, and accelerometer/
gyroscope behavior across Android devices, further tuning may still be needed
— the relevant constants (`BASS_LOW`/`BASS_HIGH`, the `MIC_*` gate constants,
the `MOTION_*`/`ROTATION_WEIGHT` constants) are grouped together in
`index.html` and commented for exactly this kind of adjustment.

## License

Code in this directory has no separate license file — it inherits whatever
applies to the rest of this repository. The bundled font
(`fonts/JuliusSansOne-Regular.woff2`) is licensed separately under the SIL
Open Font License; see `fonts/OFL.txt`.
