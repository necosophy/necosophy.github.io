# kiosk

A retro CRT-terminal dashboard for a wall-mounted display. Black background,
phosphor green text, scanlines, vignette, sharp corners — built to run 24/7
on an old Android phone in [Fully Kiosk Browser](https://www.fully-kiosk.com/).

**Live:** https://necosophy.github.io/kiosk/

## What's on it

Three rows: three small tiles, three small tiles, two larger tiles.

- **Clock** — HH:MM:SS, local time.
- **Weather** — current temperature/condition + 2-day forecast for Cahuita,
  Costa Rica, via [Open-Meteo](https://open-meteo.com/) (no API key).
- **Sun** — sunrise, sunset, solar noon, and a live "daylight remaining"
  countdown (or "sunrise in…" overnight). Computed entirely locally — no
  network call.
- **Moon** — phase, illumination %, moonrise/moonset, and current
  distance to the Moon in km. Also computed entirely locally.
- **Planets tonight** — which of Mercury/Venus/Mars/Jupiter/Saturn are
  currently above the horizon (shown with rough compass direction +
  altitude), or a "daytime" note when the sun's up. Computed locally,
  refreshed hourly.
- **Next event** — next full moon, next new moon, and (if within ~60 days)
  the next meteor shower or eclipse. Computed locally, refreshed daily.
- **Headlines** — rotates through BBC World headlines, fetched via
  [rss2json](https://rss2json.com/).
- **Critters** — a small canvas animation: a green cat chasing an amber
  lizard around the tile, both wandering with randomized paths. The lizard
  darts erratically now and then; the cat is always a little slower, so it
  never actually catches it.

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
`try/catch`:

- On failure, a tile falls back to its last successfully-fetched value
  (cached in `localStorage`) so a temporary outage doesn't blank a tile.
- If there's no cached value either (e.g. first load with no network), the
  tile shows `—` instead of breaking the layout.
- Each data source refreshes on its own independent `setInterval`, so one
  slow/dead API never blocks the others.

Refresh cadence: weather hourly, sun/moon/planets hourly (cheap local
calc; the daylight countdown itself re-ticks every second off cached
sunrise/sunset times, no recomputation), next-event daily, news every 15
min (headlines rotate every 8s). The astronomy tiles have nothing to
fail over to begin with — they're local math, not fetches — so they stay
correct even with no network at all.

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

The page itself requests fullscreen (`document.documentElement.requestFullscreen()`)
on the very first tap anywhere on the screen — browsers block automatic
fullscreen without a user gesture, so this is as close to automatic as the
web platform allows. If you still see a persistent top bar or address bar
after that first tap, that's almost certainly coming from **Fully Kiosk
Browser's own UI**, not the page — the Fullscreen API only ever controls
the *browser's own* chrome, and Fully Kiosk draws some of its bars on top
of that. Check these Fully Kiosk settings, which suppress its chrome
independent of anything the page does:

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
- **News source** — change the RSS URL passed to rss2json in `fetchNews()`
  (any public RSS feed works — swap in Reuters World, a local paper, etc.).
- **Eclipse table** — extend the `ECLIPSES` array once its dates run out
  (see "How the astronomy tiles work" above).
- **Colors/accents** — the CSS custom properties at the top of `<style>`
  (`--green`, `--cyan`, `--amber`, `--magenta`) control the palette; each
  tile picks one via its `--accent` override.
- **Refresh intervals** — each data source calls its own
  `setInterval(fn, ms)` near the bottom of the script.
