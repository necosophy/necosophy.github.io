// ---------------------------------------------------------------------------
// Cat Purr Generator — skeleton anchors & poses
//
// The cat is a set of named "bone" anchors. Each pose is just a target
// position for every anchor; particles are generated once around each
// anchor (see catModel.js) and simply ride along as anchors tween between
// poses, so adding a pose is only a matter of adding a new position set here.
//
// Coordinate space: y-up, cat faces +Z (front paws / muzzle toward +Z,
// tail toward -Z).
// ---------------------------------------------------------------------------

export const POSES = {
  // Alert, upright sitting position. Default pose.
  idle: {
    earL: [-0.22, 2.05, 0.78],
    earR: [0.22, 2.05, 0.78],
    head: [0, 1.72, 0.85],
    muzzle: [0, 1.55, 1.15],
    neck: [0, 1.38, 0.55],
    chestFront: [0, 1.05, 0.32],
    spineMid: [0, 0.85, -0.18],
    hip: [0, 0.78, -0.62],
    tailBase: [0, 0.85, -0.92],
    tailMid: [0.4, 1.05, -1.28],
    tailTip: [0.62, 1.35, -1.1],
    legFL: [-0.32, 0.5, 0.4],
    legFR: [0.32, 0.5, 0.4],
    legBL: [-0.38, 0.35, -0.55],
    legBR: [0.38, 0.35, -0.55],
    pawFL: [-0.34, 0.02, 0.48],
    pawFR: [0.34, 0.02, 0.48],
    pawBL: [-0.42, 0.02, -0.62],
    pawBR: [0.42, 0.02, -0.62],
  },

  // Relaxed sit, tail curled around the front paws.
  sit: {
    earL: [-0.24, 1.85, 0.7],
    earR: [0.24, 1.85, 0.7],
    head: [0, 1.55, 0.8],
    muzzle: [0, 1.4, 1.08],
    neck: [0, 1.2, 0.5],
    chestFront: [0, 0.92, 0.3],
    spineMid: [0, 0.78, -0.15],
    hip: [0, 0.72, -0.55],
    tailBase: [0, 0.55, -0.62],
    tailMid: [0.28, 0.28, 0.05],
    tailTip: [0.15, 0.15, 0.55],
    legFL: [-0.3, 0.35, 0.42],
    legFR: [0.3, 0.35, 0.42],
    legBL: [-0.4, 0.3, -0.45],
    legBR: [0.4, 0.3, -0.45],
    pawFL: [-0.28, 0.02, 0.52],
    pawFR: [0.28, 0.02, 0.52],
    pawBL: [-0.44, 0.02, -0.5],
    pawBR: [0.44, 0.02, -0.5],
  },

  // Loafing / curled lie-down, legs tucked under, head resting low.
  lie: {
    earL: [-0.22, 1.35, 0.75],
    earR: [0.22, 1.35, 0.75],
    head: [0, 1.15, 0.95],
    muzzle: [0, 1.0, 1.25],
    neck: [0, 0.92, 0.55],
    chestFront: [0, 0.62, 0.28],
    spineMid: [0, 0.55, -0.2],
    hip: [0, 0.55, -0.65],
    tailBase: [0, 0.5, -0.85],
    tailMid: [-0.35, 0.35, -0.55],
    tailTip: [-0.5, 0.28, -0.05],
    legFL: [-0.28, 0.22, 0.35],
    legFR: [0.28, 0.22, 0.35],
    legBL: [-0.35, 0.2, -0.5],
    legBR: [0.35, 0.2, -0.5],
    pawFL: [-0.22, 0.05, 0.55],
    pawFR: [0.22, 0.05, 0.55],
    pawBL: [-0.3, 0.05, -0.35],
    pawBR: [0.3, 0.05, -0.35],
  },

  // Arched-back stretch, hips raised, front paws pushed forward and low.
  // Brief pose — main.js/catModel.js auto-return this to idle.
  stretch: {
    earL: [-0.2, 1.1, 1.3],
    earR: [0.2, 1.1, 1.3],
    head: [0, 0.85, 1.55],
    muzzle: [0, 0.6, 1.85],
    neck: [0, 0.78, 1.0],
    chestFront: [0, 0.5, 0.55],
    spineMid: [0, 1.0, -0.1],
    hip: [0, 1.25, -0.6],
    tailBase: [0, 1.3, -0.95],
    tailMid: [0.15, 1.55, -1.3],
    tailTip: [0.25, 1.7, -1.5],
    legFL: [-0.32, 0.25, 1.15],
    legFR: [0.32, 0.25, 1.15],
    legBL: [-0.4, 0.85, -0.5],
    legBR: [0.4, 0.85, -0.5],
    pawFL: [-0.34, 0.02, 1.35],
    pawFR: [0.34, 0.02, 1.35],
    pawBL: [-0.42, 0.02, -0.55],
    pawBR: [0.42, 0.02, -0.55],
  },
};

export const BONE_ORDER = Object.keys(POSES.idle);

// Glow-line connections between anchors, used to hint the cat's silhouette.
export const BONE_LINKS = [
  ['earL', 'head'], ['earR', 'head'],
  ['head', 'muzzle'], ['head', 'neck'],
  ['neck', 'chestFront'], ['chestFront', 'spineMid'], ['spineMid', 'hip'],
  ['hip', 'tailBase'], ['tailBase', 'tailMid'], ['tailMid', 'tailTip'],
  ['chestFront', 'legFL'], ['chestFront', 'legFR'],
  ['hip', 'legBL'], ['hip', 'legBR'],
  ['legFL', 'pawFL'], ['legFR', 'pawFR'],
  ['legBL', 'pawBL'], ['legBR', 'pawBR'],
];
