// ---------------------------------------------------------------------------
// Cat Purr Generator — config
// Everything you're likely to want to retune lives in this file.
// MIDI note numbers use the C4 = 60 (middle C) convention.
// ---------------------------------------------------------------------------

export const NOTE = {
  C3: 48, Db3: 49, D3: 50, Eb3: 51, E3: 52, F3: 53,
  Gb3: 54, G3: 55, Ab3: 56, A3: 57, Bb3: 58, B3: 59,
};

// key -> pose name. Edit freely to remap the AKAI MPK Mini pads/keys.
export const KEY_TO_POSE = {
  [NOTE.C3]: 'sit',
  [NOTE.D3]: 'lie',
  [NOTE.E3]: 'stretch',
  [NOTE.F3]: 'idle',
};

export const POSE_LABELS = {
  idle: 'Idle / sit-up (alert)',
  sit: 'Sit (relaxed, tail curled)',
  lie: 'Lie down (loafing)',
  stretch: 'Stretch (auto-returns)',
};

export const DEFAULT_POSE = 'idle';

export const MOD_WHEEL_CC = 1;

export const POSE_TRANSITION_SECONDS = 1.6; // never a snap-cut
export const STRETCH_HOLD_SECONDS = 3.2;    // auto-return to idle after this long

// Ambient camera drift, scaled by the mod wheel (CC1): 0 -> driftBase, 127 -> driftMax.
export const CAMERA = {
  driftBase: 0.05,
  driftMax: 0.55,
  driftSpeed: 0.12,
  distance: 4.3,
  height: 1.1,
};

// Idle particle shimmer/jitter, also scaled by the mod wheel.
export const SHIMMER = {
  base: 0.012,
  max: 0.11,
  speed: 3.5,
};

// Purr synthesis (Web Audio, fully synthesized — no samples).
export const PURR = {
  ampModRateHz: 24,        // base purr amplitude-modulation rate
  ampModRateVelocityRange: 9, // +/- Hz nudge from note velocity
  maxVolume: 0.55,
  fadeInSeconds: 0.7,
  fadeOutSeconds: 0.9,
  pitchBendSemitoneRange: 5, // how far "other notes" can bend purr rate/filter while sustained
  // Per-pose timbre. `chirp: true` poses play a short trill instead of a purr loop.
  poseTimbre: {
    idle:    { filterFreq: 360, rateMul: 1.00, rumble: 105 },
    sit:     { filterFreq: 300, rateMul: 0.92, rumble: 90 },
    lie:     { filterFreq: 210, rateMul: 0.78, rumble: 70 }, // deeper, slower
    stretch: { chirp: true, chirpFrom: 900, chirpTo: 1500, chirpDuration: 0.42 },
  },
};
