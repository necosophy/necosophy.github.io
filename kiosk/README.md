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
- **Critters** (violet) — a small canvas animation: a copper cat (roughly
  twice the size of the lizard, legs shown as thin stroked lines) chasing
  an amber lizard around the tile, past a handful of faint pine-silhouette
  shapes that drift in and out of view in the background. Both critters
  wander with randomized paths; the lizard darts erratically and
  occasionally flicks a small forked tongue, and the cat is always a
  little slower, so it never actually catches it.

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
  body text color everywhere else), `--pink` (Clock), `--cream` (Moon),
  `--cyan` (Planets), `--amber` (Sun), `--violet` (Next Event). Critters
  reuses `--violet` — the only repeated tone — but it's placed two tiles
  away from Next Event on the grid, so no two tiles that actually share
  an edge repeat a color. Check adjacency before reusing a tone if you
  rearrange tiles. `--copper-dim`/`--cream-dim` are dimmed variants used
  for label text.
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
