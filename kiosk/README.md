# kiosk

A retro CRT-terminal dashboard for a wall-mounted display. Black background,
copper phosphor text, scanlines, vignette, sharp corners — built to run 24/7
on an old Android phone in [Fully Kiosk Browser](https://www.fully-kiosk.com/).

**Live:** https://necosophy.github.io/kiosk/

## What's on it

Three rows: two tiles, three tiles, two larger tiles.

- **Clock** — HH:MM:SS, local time, in pink.
- **Sun** (amber) — sunrise, sunset, solar noon, and a live "daylight
  remaining" countdown (or "sunrise in…" overnight). Computed entirely
  locally — no network call.
- **Moon** (cream/off-white) — phase, illumination %, moonrise/moonset,
  and current distance to the Moon in km. Computed entirely locally.
- **Planets tonight** (dim cyan) — which of Mercury/Venus/Mars/Jupiter/Saturn
  are currently above the horizon (shown with rough compass direction +
  altitude), or a "daytime" note when the sun's up. Computed locally,
  refreshed hourly.
- **Next event** (muted violet) — next full moon, next new moon, and (if
  within ~60 days) the next meteor shower or eclipse. Computed locally,
  refreshed daily.
- **Weather** (copper) — current conditions for Cahuita, Costa Rica, laid
  out as a two-column grid: temperature, condition, and feels-like on the
  left; wind (speed + compass direction), humidity, pressure, cloud cover,
  and 6-hour precipitation probability on the right, plus a 2-day forecast
  strip along the bottom. Via [Open-Meteo](https://open-meteo.com/) (no
  API key).
- **Cat & Lizard** (pink, matching Clock) — a small canvas animation: a
  copper cat (roughly twice the size of the lizard, with pixel eyes, a
  nose, whiskers, and proportional leg blocks — all still built from the
  same size pixel grid as the rest of the sprite, not a finer/smoother
  drawing) chasing an amber lizard around the tile, past a handful of
  faint pine-silhouette shapes that drift in and out of view in the
  background. Both critters wander with randomized paths; the lizard
  darts erratically and occasionally flicks a small forked tongue, and
  the cat is always a little slower, so it never actually catches it.

Each tile's accent color is chosen so no two *adjacent* tiles share one —
see "Colors/accents" under Adjusting for the full palette and the
adjacency reasoning.

Every tile's content — headers, labels, values — is centered rather than
left-aligned, and every label/value data row (RISE/SET, WIND/HUMIDITY/etc.)
uses one shared pattern: a fixed-width row with the label pinned to the
left edge and the value pinned to the right, so every row in a tile lands
on the same two column positions instead of running together at
inconsistent spacing. See "Data vs. label sizing" under Adjusting.

Everything is a single static `index.html` — inline CSS and JS, no build
step, no dependencies beyond a Google Fonts link.

### How the astronomy tiles work

Sun/Moon/Planets/Next-event need no API and no key — they're pure local
computation:

- **Sun and Moon** use [SunCalc](https://github.com/mourner/suncalc)
  (BSD-2-Clause, © Vladimir Agafonkin), vendored directly into
  `index.html` rather than loaded from a CDN, so it works with zero
  network dependency on a kiosk that might be offline for stretches.
- **Planets** use a compact low-precision orbital-elements calculation
  (the classic method described by Paul Schlyter, accurate to roughly a
  degree — plenty for "is it above the horizon," not for precision
  astrometry).
- **Next full/new moon** is found by stepping the Moon's phase forward in
  3-hour increments and detecting where it crosses new/full — so dates
  are accurate but times aren't implied (the UI only shows the date).
- **Meteor showers** are a small table of recurring annual peak dates
  (Perseids, Geminids, etc.) — these never need updating.
- **Eclipses** are a small hand-maintained table (`ECLIPSES` near the
  "NEXT CELESTIAL EVENT" section in `index.html`) covering into 2027.
  Unlike the meteor-shower table, this one is *not* self-perpetuating —
  extend it with future eclipse dates once it runs out.

## Resilience

This is meant to run unattended for weeks. Every fetch is wrapped in
`try/catch` *and* a hard timeout:

- **Every network call is bounded to 12 seconds** via `AbortController`
  (see `fetchWithTimeout` in `index.html`). This isn't optional dressing —
  a bare `fetch()` with no timeout can hang forever on a stalled
  connection without ever resolving *or* rejecting, which silently
  defeats a plain `try/catch`: the `.catch()` handler simply never runs,
  so the tile is stuck on its placeholder indefinitely with no visible
  sign anything is wrong. That was the root cause the last time the
  weather tile went blank. Wrapping the call in a timeout guarantees it
  settles one way or the other, so the fallback path below always fires.
- On failure, a tile falls back to its last successfully-fetched value
  (cached in `localStorage`) so a temporary outage doesn't blank a tile.
- If there's no cached value either (e.g. first load with no network), the
  tile shows `—` instead of breaking the layout.
- Each data source refreshes on its own independent `setInterval`, so one
  slow/dead API never blocks the others.

Refresh cadence: weather hourly, sun/moon/planets hourly (cheap local
calc; the daylight countdown itself re-ticks every second off cached
sunrise/sunset times, no recomputation), next-event daily. The astronomy
tiles have nothing to fail over to begin with — they're local math, not
fetches — so they stay correct even with no network at all.

## Fullscreen and the "bottom row cut off" bug

Two unrelated problems used to combine to cut off the bottom row of tiles,
and both are fixed now:

1. **The fullscreen request wasn't reliable.** `requestFullscreen()` must
   run synchronously inside a trusted user-gesture handler with nothing
   async in between, or many mobile browsers silently reject it — and a
   single `{once: true}` attempt meant one failed try left the browser's
   own address bar on screen for good, eating into the visible height.
   The listener now stays registered on `click`, `touchend`, *and*
   `pointerdown` (not just one), keeps retrying on every subsequent tap
   rather than giving up after one attempt, and skips the request
   entirely once `document.fullscreenElement` confirms it's already
   active.
2. **Even with fullscreen working, `100vh` doesn't shrink when a browser
   shows its own chrome** (address bar, etc.) — it's fixed to the full
   layout viewport regardless. `100dvh` (dynamic viewport height) tracks
   the *actual visible* viewport instead, so the dashboard now sizes
   itself with `height:100vh; height:100dvh;` (older browsers that don't
   understand `dvh` simply keep the `vh` value before it) — belt-and-suspenders
   with fix #1, so a chrome bar that does end up on screen for any reason
   still doesn't push content below the fold.
3. **A separate CSS Grid bug, found and fixed while testing #2**: the
   three row-wrapper `<div>`s (`.row-top`/`.row-astro`/`.row-bottom`) are
   themselves grid *items* of the outer `.dashboard` grid, and a grid
   item's default `min-height` is `auto` — its content's natural size —
   not `0`. That meant a row whose tile content was taller than its
   `vh`/`1fr` track allocation (which became a real risk once the body
   font sizes below were doubled) could force the *entire row* taller
   than intended, pushing it past the viewport where `body`'s
   `overflow:hidden` would silently clip it — reproducing the exact
   "bottom row cut off" symptom, just from a completely different cause
   than the fullscreen issue. All three row wrappers now set
   `min-height:0` to let the grid's own track sizing win instead.

Verified by simulating a shrunk viewport (down to 120px shorter than full
height, comfortably past any real Android address bar) with a full
Playwright overflow check at each step — zero overflow anywhere in that
range, both before and after the grid fix confirmed the difference.

**A further real-device report, round 1**: on-device testing (Firefox for
Android, where fullscreen itself works — see the known gap below) found
the Sun and Weather tiles' last row still clipped at the bottom edge,
despite no overflow showing up in this project's Chromium-based testing
at the same 1920×1080 size. The suspected cause was a font-metric/
line-height difference between Firefox's and Chromium's rendering of
JetBrains Mono that this testing setup couldn't reproduce (this
environment has no Firefox build available to verify against directly).
The fix applied then was a generous but untargeted one — more row height
for Sun, trimmed tile padding, tightened Sun/Weather internal spacing —
which measured out to roughly 40px of slack in this project's Chromium
testing. **That fix turned out to be insufficient**: the same device
still showed Moon's rise/set/distance numbers and Weather's forecast row
touching or crossing the bottom border after that change shipped.

**Round 2 — the actual root cause.** ~40px of slack sounds like a lot
until you notice it was resting entirely on `justify-content:center`
splitting whatever free space exists evenly above and below the tile's
content — space, not a reserved minimum. Several elements in the Sun,
Moon, and Weather tiles had no explicit `line-height` at all, relying on
the browser's own "normal" default, which is derived from font metrics
that genuinely differ between rendering engines (and can differ further
depending on whether the JetBrains Mono webfont has finished loading vs.
a fallback monospace font being used). That's not a hunch this time — it
was reproduced directly: forcing `line-height: 1.5` on every text element
in this project's own Chromium testing (simulating a browser with less
generous default metrics, without needing an actual Firefox build) pushed
Sun, Moon, and Weather from a comfortable-looking positive margin straight
into `scrollHeight > clientHeight` overflow — i.e. exactly the clipping
reported, from exactly the mechanism suspected: fixed-height tiles with
content whose real height depends on metrics this project can't fully
control or predict.

The fix has two parts:
1. **Every text element in every tile now sets an explicit `line-height`**
   (down from `body` as a baseline default up to each individual rule),
   so text height is deterministic instead of depending on a given
   browser/font's idea of "normal."
2. **Sun, Moon, and Weather's content was made meaningfully smaller** —
   the moon's disc graphic, the sun's hero countdown digits, the weather
   tile's temperature and stat values, and several `margin-top` values all
   came down a notch — freeing real pixels rather than relying on
   centering to distribute existing slack more favorably. Measured result
   in this project's Chromium testing: normal-case slack below the last
   row roughly *doubled* for all three tiles (Sun ~42px→~55px, Moon
   ~23px→~42px, Weather ~41px→~63px, all now 13–17% of the tile's own
   height instead of 7–13%), and — the number that actually matters here —
   even under the artificial `line-height: 1.5` stress test described
   above, all three tiles now stay positive (no overflow) instead of going
   negative as they did before this round's fix.

As before, **this is still Chromium-based reasoning, not a Firefox-for-
Android reproduction** — this sandbox has no Firefox build to verify
against directly, so please confirm on the actual phone. But unlike round
1's fix, this one specifically targets and closes the exact failure mode
(unset line-height + thin margins) that was directly demonstrated to
reproduce the reported symptom, rather than adding an untargeted safety
margin and hoping it was enough. If it still clips, the next lever is
comparing Firefox's actual rendered `line-height` for JetBrains Mono
against the values assumed here (via on-device remote debugging), since
that's now the one variable this testing setup genuinely cannot observe.

**Known gap:** on-device testing on Brave for Android found the address
bar still visible after tapping. The gesture-handling logic itself
checked out under both synthetic mouse and touch events in real desktop
Chromium (same rendering engine Brave is built on) during development,
so it's not yet confirmed whether Brave on Android specifically rejects
the request, doesn't fire the tap listeners as expected, or just doesn't
hide its own chrome even when the page's fullscreen state is genuinely
active — that would need on-device remote debugging (e.g. `chrome://inspect`
against Brave) to pin down. Firefox for Android has been confirmed to
work correctly on this same page, so it's the current recommendation if
Brave is the browser you'd otherwise reach for. Fully Kiosk Browser's own
Kiosk Mode settings (below) are the more robust fix regardless of which
browser engine sits underneath, since they suppress the browser's chrome
directly rather than depending on the page's fullscreen request at all.

## Screen wake lock

The page requests the [Screen Wake Lock
API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
(`navigator.wakeLock.request('screen')`) on load, and re-requests it
whenever the page becomes visible again — some browsers silently release
the lock when a tab is backgrounded and don't restore it automatically.
If the API isn't available at all, the request is a no-op (feature-detected,
never throws).

Treat this as a first layer, not the only one: **also enable Fully Kiosk
Browser's own "Keep Screen On" setting** as a belt-and-suspenders backup,
in case the Wake Lock API isn't fully supported in that particular WebView
build. Both can be on at once with no conflict.

## Deploying

This lives inside the `necosophy.github.io` repo, so it deploys automatically
with everything else on GitHub Pages:

1. Push changes to `main` (or whatever branch Pages is configured to serve).
2. GitHub Pages picks it up within a minute or two.
3. It's live at `https://necosophy.github.io/kiosk/`.

No build step, no secrets, no server — it's a static file.

## Setting up the kiosk phone (Honor 5X, landscape 1920×1080)

1. Install **Fully Kiosk Browser** (Play Store, or sideload the APK from
   [fully-kiosk.com](https://www.fully-kiosk.com/) if the Play Store isn't
   available on the device).
2. Rotate the device to landscape and lock rotation (Fully Kiosk Browser
   settings → **Device Management** → lock orientation to landscape).
3. In Fully Kiosk Browser settings → **Web Content Settings**, set the
   start URL to `https://necosophy.github.io/kiosk/`.
4. Under **Web Content Settings**, enable JavaScript (on by default) and
   disable the pull-to-refresh/zoom gestures so nothing accidentally
   scrolls or zooms the dashboard.
5. Under **Motion Detection / Screensaver**, disable any screensaver or
   screen-off timeout you don't want — the dashboard is designed to be left
   on continuously.
6. Under **Other Settings**, enable **Start on Boot** and **Auto-reload
   after connection loss** if you want the kiosk to self-heal after a power
   cut or Wi-Fi drop. Reloading is safe — the page has no state that needs
   to survive a reload (cached tile data lives in `localStorage`, but
   everything also loads fine from scratch).
7. Optional: enable **Screen Always On** so the display never sleeps.

That's it — no app to install beyond the browser, no keys to configure, no
backend to run.

### Getting rid of the browser chrome / status bar

The page itself requests fullscreen on every tap until it succeeds (see
"Fullscreen and the 'bottom row cut off' bug" above) — browsers block
*automatic* fullscreen with no gesture at all, so a tap is as close to
automatic as the web platform allows, and the layout no longer relies on
fullscreen actually landing anyway (the `100dvh` fallback covers that
case). If you still see a persistent top bar or address bar after
tapping, that's almost certainly coming from **Fully Kiosk Browser's own
UI**, not the page — the Fullscreen API only ever controls the *browser's
own* chrome, and Fully Kiosk draws some of its bars on top of that. Check
these Fully Kiosk settings, which suppress its chrome independent of
anything the page does:

- **Enable Kiosk Mode**
- **Hide Status Bar**
- **Fullscreen Mode**

All three live under Fully Kiosk's **Web Content Settings** /
**Motion Detection** / **Device Management** screens depending on version;
search Fully Kiosk's in-app settings search for "status bar" / "kiosk
mode" / "fullscreen" if they've moved.

## Adjusting

Everything lives in `kiosk/index.html`:

- **Location** — change the `LAT`/`LON` constants near the top of the
  `<script>` block, and the `CAHUITA, CR` label in the weather tile's
  `.tile-head`. This also moves the Sun/Moon/Planets calculations, since
  they all read the same two constants.
- **Eclipse table** — extend the `ECLIPSES` array once its dates run out
  (see "How the astronomy tiles work" above).
- **Colors/accents** — six tones live as CSS custom properties at the top
  of `<style>`, each tile setting its own via the `--accent` custom
  property on its `#tile-*` rule: `--copper` (Weather, and the default
  body text color everywhere else), `--pink` (Clock *and* Cat & Lizard),
  `--cream` (Moon), `--cyan` (Planets), `--amber` (Sun), `--violet` (Next
  Event, currently the only tile using it). Clock and Cat & Lizard are
  the one repeated pair, by request — they're diagonally opposite corners
  of the grid, not sharing an edge, so it doesn't violate the "no two
  *adjacent* tiles share a color" rule the rest of the palette follows.
  Check adjacency before reusing a tone elsewhere if you rearrange tiles.
  `--copper-dim`/`--cream-dim` are dimmed variants used for label text.
- **Data vs. label sizing and alignment** — the small dim-label /
  large-bright-value pattern used throughout (RISE/SET/WIND/etc.) is one
  shared CSS class, `.stat-line` (`.lbl` for the label, a `<b>` for the
  value), laid out as `display:flex; justify-content:space-between` at a
  *fixed* width set via the `--stat-w` custom property — every row in a
  tile shares the same `--stat-w`, so as a group they line up into a real
  two-column table even though each row is independently centered within
  the tile. `--stat-w` is set once per tile (e.g. `#tile-sun{--stat-w:12vw;}`);
  Weather sets it separately per column since its two columns hold very
  different content (`.wx-col:first-child`/`:last-child`). Next Event's
  `.ne-line` and Planets' `.planet-line` use the identical technique with
  their own width, since their content doesn't fit the shared class
  cleanly. **If you widen any label or value text, check `--stat-w` still
  fits it** — too narrow and the text silently wraps onto two lines
  instead of overflowing visibly, which is easy to miss without an actual
  screenshot (this happened during development: `white-space:nowrap` is
  set on every label/value as a backstop, but the width itself still needs
  to be generous enough that content is never forced to shrink below its
  natural size in the first place).
- **Fetch timeout** — the `12000` (ms) argument to `fetchWithTimeout` in
  the weather fetch; raise it if you're on a persistently slow connection
  and 12s is triggering false "stale" states.
- **Refresh intervals** — each data source calls its own
  `setInterval(fn, ms)` near the bottom of the script.
