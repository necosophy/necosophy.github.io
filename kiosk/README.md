# kiosk

A retro CRT-terminal dashboard for a wall-mounted display. Black background,
phosphor green text, scanlines, vignette, sharp corners — built to run 24/7
on an old Android phone in [Fully Kiosk Browser](https://www.fully-kiosk.com/).

**Live:** https://necosophy.github.io/kiosk/

## What's on it

- **Clock** — HH:MM:SS, local time.
- **Weather** — current temperature/condition + 2-day forecast for Cahuita,
  Costa Rica, via [Open-Meteo](https://open-meteo.com/) (no API key).
- **Moon phase / UV index** — moon phase is computed locally with a JS
  astronomical formula (no network call); UV index comes from the same
  Open-Meteo response as the weather tile.
- **Headlines** — rotates through BBC World headlines, fetched via
  [rss2json](https://rss2json.com/).
- **Quote of the day** — from [ZenQuotes](https://zenquotes.io/), with an
  [allorigins](https://allorigins.win/) CORS-proxy fallback and a small
  bundled quote list if both are unreachable.
- **On this day in history** — from [Wikipedia's On This Day
  API](https://www.mediawiki.org/wiki/API:On_this_day).
- **Joke box** — a new dad joke every few minutes from
  [icanhazdadjoke.com](https://icanhazdadjoke.com/), with a small CSS/SVG cat
  that blinks and "talks" when a new one arrives.

Everything is a single static `index.html` — inline CSS and JS, no build
step, no dependencies beyond a Google Fonts link.

## Resilience

This is meant to run unattended for weeks. Every fetch is wrapped in
`try/catch`:

- On failure, a tile falls back to its last successfully-fetched value
  (cached in `localStorage`) so a temporary outage doesn't blank a tile.
- If there's no cached value either (e.g. first load with no network), the
  tile shows `—` instead of breaking the layout.
- Each data source refreshes on its own independent `setInterval`, so one
  slow/dead API never blocks the others.

Refresh cadence: weather/UV hourly, moon phase hourly (cheap local calc),
news every 15 min (headlines rotate every 8s), quote once daily, history
once daily, joke every 4 minutes.

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

## Adjusting

Everything lives in `kiosk/index.html`:

- **Location** — change the `LAT`/`LON` constants near the top of the
  `<script>` block, and the `CAHUITA, CR` label in the weather tile's
  `.tile-head`.
- **News source** — change the RSS URL passed to rss2json in `fetchNews()`
  (any public RSS feed works — swap in Reuters World, a local paper, etc.).
- **Colors/accents** — the CSS custom properties at the top of `<style>`
  (`--green`, `--cyan`, `--amber`, `--magenta`) control the palette; each
  tile picks one via its `--accent` override.
- **Refresh intervals** — each data source calls its own
  `setInterval(fn, ms)` near the bottom of the script.
