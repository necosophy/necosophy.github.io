import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { Cat } from './catMesh.js';
import { PurrSynth } from './purrSynth.js';
import { initMIDI } from './midi.js';
import {
  NOTE, KEY_TO_POSE, POSE_LABELS, MOD_WHEEL_CC, CAMERA, SHIMMER,
} from './config.js';

// ---------------------------------------------------------------------------
// Scene setup
// ---------------------------------------------------------------------------
const container = document.getElementById('app');

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05070a, 0.045);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05070a, 1);
container.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.35, // strength
  0.55, // radius
  0.12  // threshold
);
composer.addPass(bloomPass);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

const cat = new Cat(scene);
const purr = new PurrSynth();

// ---------------------------------------------------------------------------
// Legend UI
// ---------------------------------------------------------------------------
const noteNameByNumber = Object.fromEntries(Object.entries(NOTE).map(([name, num]) => [num, name]));
const noteToPose = { ...KEY_TO_POSE };

const legendRows = document.getElementById('legend-rows');
for (const [note, pose] of Object.entries(KEY_TO_POSE)) {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<span class="key">${noteNameByNumber[note] ?? note}</span><span>${POSE_LABELS[pose] ?? pose}</span>`;
  legendRows.appendChild(row);
}
const modRow = document.createElement('div');
modRow.className = 'row';
modRow.innerHTML = `<span class="key">Mod wheel</span><span>camera drift + shimmer</span>`;
legendRows.appendChild(modRow);

console.log('[cat-purr] key -> pose mapping', KEY_TO_POSE);
console.log('[cat-purr] mod wheel CC', MOD_WHEEL_CC, '-> camera drift + shimmer');

const midiStatusEl = document.getElementById('midi-status');
function setMidiStatus({ ok, message }) {
  midiStatusEl.textContent = `MIDI: ${message}`;
  midiStatusEl.className = `status ${ok ? 'ok' : 'warn'}`;
}

// ---------------------------------------------------------------------------
// Audio gate — AudioContext needs a user gesture before it can play.
// ---------------------------------------------------------------------------
const audioGate = document.getElementById('audio-gate');
audioGate.addEventListener('click', () => {
  purr.resume();
  audioGate.classList.add('hidden');
}, { once: true });

// ---------------------------------------------------------------------------
// MIDI wiring
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
const heldPoseNotes = new Set();
let modWheelNorm = 0;

initMIDI({
  onStatus: setMidiStatus,
  onNoteOn(note, velocity) {
    const pose = noteToPose[note];
    if (pose) {
      heldPoseNotes.add(note);
      cat.triggerPose(pose, clock.elapsedTime);
      purr.trigger(pose, velocity);
    } else {
      purr.modulateFromNote(note);
    }
  },
  onNoteOff(note) {
    if (!(note in noteToPose)) return;
    heldPoseNotes.delete(note);
    if (heldPoseNotes.size === 0) purr.release();
  },
  onCC(cc, value) {
    if (cc === MOD_WHEEL_CC) modWheelNorm = value / 127;
  },
});

// ---------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------
let smoothedModWheel = 0;
const lookAt = new THREE.Vector3(0, 1.0, -0.2);
const baseAngle = 1.15; // near side-profile, slightly turned toward camera

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const elapsed = clock.elapsedTime;

  smoothedModWheel += (modWheelNorm - smoothedModWheel) * Math.min(1, dt * 2);

  cat.setShimmerTarget(SHIMMER.base + smoothedModWheel * (SHIMMER.max - SHIMMER.base));
  cat.update(dt, elapsed);

  const driftAmount = CAMERA.driftBase + smoothedModWheel * (CAMERA.driftMax - CAMERA.driftBase);
  const angle = baseAngle + Math.sin(elapsed * CAMERA.driftSpeed) * driftAmount;
  camera.position.x = Math.sin(angle) * CAMERA.distance;
  camera.position.z = Math.cos(angle) * CAMERA.distance;
  camera.position.y = CAMERA.height + Math.sin(elapsed * CAMERA.driftSpeed * 0.6) * driftAmount * 0.4;
  camera.lookAt(lookAt);

  composer.render();
}

animate();

// Dev-only console helper for exercising poses/purr without a MIDI device
// plugged in, e.g. `debugCat.trigger('stretch', 100)`. Stripped from builds.
if (import.meta.env.DEV) {
  window.debugCat = {
    cat,
    purr,
    trigger(pose, velocity = 100) {
      cat.triggerPose(pose, clock.elapsedTime);
      purr.trigger(pose, velocity);
    },
    release() {
      purr.release();
    },
    setModWheel(value) {
      modWheelNorm = value / 127;
    },
  };
}
