# Triwald

An offline, browser-based ambient instrument that turns three phone sensors into
three live musical voices — no app store, no account, no server, and no MIDI
hardware required.

**Live:** https://necosophy.github.io/triwald/

## The three voices

| Sensor | Voice | Character |
| --- | --- | --- |
| Ambient light (camera) | Bass | Soft ambient pad with a reverb wash, slow attack/release — scale-quantized |
| Compass heading | Lead | Continuous, held drone — turning the phone slides its pitch, holding a heading sustains a tone — scale-quantized |
| Motion (accelerometer + gyroscope) | Percussion | Unscaled, irregular/polyrhythmic hits, synthesized woody timbres |

Motion and the compass both use only the phone's accelerometer/gyroscope and
magnetometer-derived heading (all delivered by `devicemotion`/
`deviceorientation` events) — neither uses, requests, or needs GPS/location
at all.

Each voice is independently monophonic (one note/tone at a time), but all
three run simultaneously and layer freely — toggle any combination on or off
with the tap targets at the top of the screen. The bass and lead share one
scale, switchable from the dropdown (F minor by default); percussion
deliberately ignores the scale entirely.

## Requirements

- **An Android phone with Chrome**, the primary target and what this app is
  built against — camera and motion/orientation sensor access need a modern
  mobile Chromium build.
- **HTTPS** (satisfied automatically by the `github.io` link above) — camera,
  compass, and motion access are all gated behind a secure context and an
  explicit tap. On iOS, both compass and motion require an explicit
  `requestPermission()` prompt tied to that same tap; Android doesn't gate
  either behind a permission dialog at all.
- No camera/compass/motion hardware, or a denied permission, simply leaves
  that one voice unavailable; the other two still work. A phone with no
  magnetometer (rare) will report `alpha`/heading as unavailable the same way
  a phone with no gyroscope already does for percussion.
- If a sensor row shows **"blocked — check site settings"** without ever
  showing a permission prompt, the browser has permanently denied that
  permission for this site already (commonly from a single accidental
  "Don't Allow" tap) — no amount of tapping the row again can undo that from
  inside the page; only the browser's own site settings can. On iOS Safari:
  tap the "aA" icon in the address bar → **Website Settings**, and change
  Camera from Deny to Ask or Allow, then reload. On Android Chrome: tap the
  padlock/info icon in the address bar → **Permissions**.

## Using it

1. Open the link above in Chrome on Android.
2. Tap **Light → Bass**, **Compass → Lead**, and/or **Motion → Percussion** to
   turn on any combination of voices — each prompts for its own permission
   the first time.
3. Pick a scale (root + mode) from the dropdown; it retunes the bass and lead
   voices immediately, live.
4. For the compass voice: once enabled it starts a sustained tone right away.
   Rotate the phone flat (like reading a compass) to slide its pitch — hold
   a heading steady to let it settle and sustain there.
5. Watch the three-zone visualizer (left = bass, middle = lead, right =
   percussion) — a continuous level bar shows the raw sensor signal (for the
   compass, its position around the bar tracks the current heading), and
   particle bursts mark each actual note or hit.
6. Tap **Record** to start capturing a take at real millisecond resolution.
   Tap it again to stop, name the file, then export.
7. **Export .mid** writes a 3-track Standard MIDI File (bass on channel 1,
   lead on channel 2, percussion on channel 10 using GM drum note numbers) from
   the same note/timing data the voices played live — for the compass voice,
   this captures discrete notes wherever a heading actually settled, not the
   continuous glide between them (see Technical notes). **Export audio**
   re-renders that same data offline through the same synth engine and
   downloads it as a `.wav`. Both try the device's native share sheet first
   and fall back to a normal download.

## Getting updates

This is a PWA with an offline-first (cache-first) service worker (`sw.js`),
which means an already-loaded copy will keep serving whatever it has cached
until the service worker script itself changes — a browser only checks the
service worker for updates by diffing its bytes, so a deploy that only
changes `index.html` doesn't get picked up on its own. Every deploy that
should reach existing installs **must bump `CACHE_NAME` in `sw.js`** (there's
a comment there as a reminder). Once that happens, the page also
auto-reloads itself the next time it's opened, to pick up the new cache
immediately rather than needing a manual hard refresh. If a change still
doesn't seem to be live, fully closing and reopening the tab/installed app
once (rather than just leaving it in the background) is the most reliable
way to let that update cycle run.

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
- **Compass → Lead**: heading comes from `event.webkitCompassHeading` on iOS
  Safari (already a true 0–360° clockwise-from-north bearing) or from
  `event.alpha` elsewhere, converted with `(360 - alpha) % 360` to match that
  same clockwise convention (raw `alpha` increases counterclockwise per the
  DeviceOrientationEvent spec). The raw heading is smoothed with an
  exponential moving average computed on its sine/cosine components rather
  than the angle directly — smoothing the angle itself breaks at the
  0°/360° wraparound (naively averaging 359° and 1° gives 180°, not 0°),
  while averaging the unit-circle components and converting back handles it
  correctly. The smoothed heading maps linearly across the full rotation to
  an index into the scale's note list (`LEAD_LOW`–`LEAD_HIGH`, F4–F6 by
  default), and the live oscillator continuously glides toward that note's
  frequency (`AudioParam.setTargetAtTime`, ~90ms time constant) — this is
  what makes it feel like a theremin: turning slides the pitch, holding
  still lets the glide settle and sustain. Recording/MIDI export can't
  represent a continuous glide with this app's hand-rolled Standard MIDI
  File writer (no pitch-bend messages), so what actually gets logged as a
  discrete note-on/off pair is wherever the (quantized) heading has held
  steady for ~200ms — an intentional simplification: the live performance
  glides continuously, the recorded/exported version captures it as the
  discrete notes it settled on along the way.
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

This app was built without a physical Android device attached for most of
its development, so constants tuned here (smoothing rates, thresholds,
envelope times) are a best-effort calibration rather than something
hand-tested from the start. Several rounds of on-device feedback have gone
into fixes; the notes below cover what's still relevant to the current code.

- **The mic-driven voice went through two earlier designs** — first a
  pitch-tracked sustained lead tone, then a long 808-style kick (fast
  pitch-drop knock into a soft-clipped ringing tail) — before being replaced
  entirely by the compass-driven continuous drone described above, on
  request. Both earlier designs, and the autocorrelation pitch detector and
  noise-gating they depended on, have been removed from the code rather than
  left dormant.
- **Bass register raised twice** (C2–G3 → C3–G4 → C4–G5, overlapping the
  bottom of the lead's own range) **and switched from sine/triangle
  oscillators to sawtooth.** A phone speaker can't move enough air below
  ~200–300Hz to make a genuinely low register audible at any volume; the
  sawtooth's rich harmonics also matter as much as the register change, since
  they put real energy into the 500Hz–2kHz band the speaker actually
  projects (a raw low fundamental plays back very weakly even once it's
  nominally "in range"). The voice is told apart from the lead by its slow
  attack and warmer filtering, not by occupying a lower pitch range.
- **Percussion's motion detection was made more robust, not just more
  sensitive.** It previously trusted `event.acceleration` (gravity already
  removed) when a device offered it, falling back to computing that removal
  itself only otherwise. `event.acceleration` depends on the OS/browser doing
  its own sensor fusion, which is exactly the kind of feature that's flaky or
  absent on older/cheaper Android phones — this app's actual target hardware
  — so gravity removal is now always done in-app from
  `accelerationIncludingGravity` alone, which needs only a basic
  accelerometer. Thresholds were also lowered substantially (more than once)
  and the gyroscope's contribution to the combined motion signal was
  increased. A phone with no gyroscope hardware simply gets `rotationRate:
  null` from `devicemotion`, which this app already handles gracefully by
  falling back to accelerometer magnitude alone — expected behavior, not a
  bug, though it does mean percussion on a gyroscope-less phone responds
  only to real shakes, not gentle tilts. If percussion is ever silent, the
  percussion zone's level bar in the visualizer reacts to raw motion
  continuously (not just on a triggered hit), so waving the phone while
  watching that bar is the fastest way to tell "not sensitive enough" from
  "`devicemotion` isn't firing at all" on that device/browser.
- **Every synthesized note/hit disconnects its audio nodes once it
  finishes.** This was missing at first and is the likely root cause of
  "sound stops entirely after a few seconds of moving the phone" reported on
  an iPhone 15 Pro: leaving stopped-but-still-connected nodes in the graph is
  a known way to make Safari/WebKit's Web Audio implementation degrade and
  eventually go silent once enough of them accumulate, and percussion in
  particular can fire many hits per second under continuous motion. Every
  voice attaches an `onended` handler that disconnects all of that note's
  nodes. Related: a retrigger on the bass (and, while it existed, the mic)
  voice relies on the engine's own internal hard-cut rather than an explicit
  release-then-attack from the calling code — the first version of that fix
  had a dead-code bug where the fast path could never actually run, since
  the call site always went through the slow release first.
- **iOS camera showing "blocked" without ever prompting**: not a code bug —
  once a browser has permanently denied a permission for a site, it rejects
  every future `getUserMedia()` call immediately, with no prompt and no way
  for the page to force one; this is standard browser security behavior, not
  something JS can override. Camera/compass/motion permission errors report
  which specific case occurred (permanently blocked / no device / in use
  elsewhere) instead of a generic "blocked — retry" that implies retrying
  might help when for that case it fundamentally can't (see Requirements
  above for how to actually clear it from the browser's own settings).
- **`sw.js`'s `CACHE_NAME` had gone several rounds without being bumped** —
  deploys that only changed `index.html` never reached already-loaded
  installs, since a service worker only gets checked for updates by
  byte-diffing its own script (see "Getting updates" above). A
  `controllerchange` listener was added so this can't silently happen again;
  a deploy just needs the `CACHE_NAME` bump and installs pick it up on next
  open without a manual hard refresh.

Given the wide range of phone speakers and sensor behavior across Android
devices, further tuning may still be needed — the relevant constants
(`BASS_LOW`/`BASS_HIGH`, `LEAD_LOW`/`LEAD_HIGH`, `HEADING_SMOOTH_ALPHA`/
`HEADING_SETTLE_MS`, the `MOTION_*`/`ROTATION_WEIGHT` constants) are grouped
together in `index.html` and commented for exactly this kind of adjustment.

## License

Code in this directory has no separate license file — it inherits whatever
applies to the rest of this repository. The bundled font
(`fonts/JuliusSansOne-Regular.woff2`) is licensed separately under the SIL
Open Font License; see `fonts/OFL.txt`.
