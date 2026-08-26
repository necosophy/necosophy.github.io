# Cat Purr Generator

A calming, glowing particle-cloud cat that reacts to MIDI keyboard input (built
for an AKAI MPK Mini) and purrs back at you through synthesized Web Audio.
No game, no UI chrome beyond a small key-mapping legend — it's meant to be
watched and listened to.

## Run it

```
npm install
npm run dev
```

Opens on **http://localhost:5183** (its own port so it can run alongside
sibling three.js/MIDI visual projects at the same time). Click anywhere once
to enable audio — browsers block `AudioContext` until a user gesture — then
connect a MIDI controller; it's picked up automatically over Web MIDI.

## What it does

- A cat built entirely from procedural wireframe geometry (no imported
  model): tapered tube segments along a skeleton of named anchor points
  form the body/neck/tail/legs, with a wireframe head, cone ears, and
  glowing eye points. Each of the four poses below is just a target
  position for every anchor, so posing is pure interpolation, eased over
  ~1.6s — never a snap-cut.
- Even with no MIDI input the cat keeps gentle idle motion: chest/spine
  particles breathe, the tail sways, ears occasionally twitch, and the
  whole cloud has a subtle shimmer/jitter.
- Purring is fully synthesized (filtered noise + a low rumble oscillator,
  amplitude-modulated at a purr-like ~20-30Hz) — no audio samples.

## MIDI mapping

| Key | Action |
| --- | --- |
| C3  | Sit (relaxed, tail curled) |
| D3  | Lie down (loafing) |
| E3  | Stretch (arched back, auto-returns to idle after a few seconds) |
| F3  | Idle / sit-up (alert) — default pose |
| Mod wheel (CC1) | Manually spin the camera around the cat (full 360°) |
| Any other note, while a pose is sustained | Bends the purr's pitch/rate, then settles back |

Velocity on a pose-triggering note controls purr loudness/character for
that trigger — harder presses purr louder and a little richer. Lying down
purrs slightly deeper and slower; stretching plays a short trill/chirp
instead of a purr.

All of this is defined at the top of `src/config.js` (key → pose mapping,
transition timings, camera drift, purr timbre per pose) and `src/poses.js`
(the actual anchor position sets), so it's easy to retune or remap without
touching the rendering/audio code.

## Structure

```
src/
  config.js      key->pose mapping, timings, purr/camera/shimmer tuning
  poses.js       skeleton anchor names, per-pose target positions, glow-line links
  catMesh.js     tube-mesh body generation + pose tweening + idle motion
  purrSynth.js   Web Audio purr/chirp synthesis
  midi.js        Web MIDI input handling
  main.js        scene, bloom post-processing, legend UI, wiring
```
