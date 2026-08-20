import * as THREE from 'three';
import { POSES, BONE_ORDER, BONE_LINKS } from './poses.js';
import { SHIMMER, POSE_TRANSITION_SECONDS, STRETCH_HOLD_SECONDS, DEFAULT_POSE } from './config.js';

// Cross-section radius per bone anchor. Tube segments taper linearly
// between the two radii of the bones they connect.
const BONE_RADIUS = {
  earL: 0.075, earR: 0.075,
  head: 0.24, muzzle: 0.1, neck: 0.22,
  chestFront: 0.26, spineMid: 0.23, hip: 0.26,
  tailBase: 0.1, tailMid: 0.08, tailTip: 0.06,
  legFL: 0.065, legFR: 0.065, legBL: 0.065, legBR: 0.065,
  pawFL: 0.075, pawFR: 0.075, pawBL: 0.075, pawBR: 0.075,
};

// Ears are modeled as standalone cones rather than tubes into the head.
const TUBE_LINKS = BONE_LINKS.filter(([a, b]) => !a.startsWith('ear') && !b.startsWith('ear'));

const RING_COUNT = 6;
const RADIAL_SEGMENTS = 7;

const UP = new THREE.Vector3(0, 1, 0);
const RIGHT_FALLBACK = new THREE.Vector3(1, 0, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// A quad-grid tube between two bone anchors, rendered as line segments.
// Topology (which vertex indices form which lines) is fixed at construction;
// only vertex positions are rewritten each frame, so posing is cheap.
class TubeSegment {
  constructor(boneA, boneB, radiusA, radiusB) {
    this.boneA = boneA;
    this.boneB = boneB;
    this.radiusA = radiusA;
    this.radiusB = radiusB;

    this.positions = new Float32Array(RING_COUNT * RADIAL_SEGMENTS * 3);

    const lineIndices = [];
    for (let r = 0; r < RING_COUNT; r++) {
      for (let k = 0; k < RADIAL_SEGMENTS; k++) {
        const a = r * RADIAL_SEGMENTS + k;
        const b = r * RADIAL_SEGMENTS + ((k + 1) % RADIAL_SEGMENTS);
        lineIndices.push(a, b);
      }
    }
    for (let r = 0; r < RING_COUNT - 1; r++) {
      for (let k = 0; k < RADIAL_SEGMENTS; k++) {
        lineIndices.push(r * RADIAL_SEGMENTS + k, (r + 1) * RADIAL_SEGMENTS + k);
      }
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setIndex(lineIndices);

    this.lines = new THREE.LineSegments(this.geometry);
  }

  update(posA, posB, shimmerAmount, shimmerSeed, radiusScaleA, radiusScaleB) {
    const dir = new THREE.Vector3().subVectors(posB, posA);
    if (dir.lengthSq() < 1e-8) return;
    dir.normalize();

    const up = Math.abs(dir.y) > 0.95 ? RIGHT_FALLBACK : UP;
    const right = new THREE.Vector3().crossVectors(up, dir).normalize();
    const trueUp = new THREE.Vector3().crossVectors(dir, right).normalize();

    const arr = this.positions;
    const center = new THREE.Vector3();
    let idx = 0;
    for (let r = 0; r < RING_COUNT; r++) {
      const t = r / (RING_COUNT - 1);
      center.lerpVectors(posA, posB, t);
      const radius = THREE.MathUtils.lerp(this.radiusA * radiusScaleA, this.radiusB * radiusScaleB, t);
      for (let k = 0; k < RADIAL_SEGMENTS; k++) {
        const angle = (k / RADIAL_SEGMENTS) * Math.PI * 2;
        const cos = Math.cos(angle) * radius;
        const sin = Math.sin(angle) * radius;
        let x = center.x + right.x * cos + trueUp.x * sin;
        let y = center.y + right.y * cos + trueUp.y * sin;
        let z = center.z + right.z * cos + trueUp.z * sin;

        if (shimmerAmount > 0.0001) {
          const jt = shimmerSeed + idx * 0.7;
          x += Math.sin(jt) * shimmerAmount * 0.5;
          y += Math.cos(jt * 1.3) * shimmerAmount * 0.5;
          z += Math.sin(jt * 0.9 + 1) * shimmerAmount * 0.5;
        }

        arr[idx * 3] = x;
        arr[idx * 3 + 1] = y;
        arr[idx * 3 + 2] = z;
        idx++;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
  }
}

export class Cat {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.boneNames = BONE_ORDER;
    this.boneCurrent = {};
    this.boneFrom = {};
    this.boneTo = {};
    for (const name of this.boneNames) {
      const p = POSES[DEFAULT_POSE][name];
      this.boneCurrent[name] = new THREE.Vector3(...p);
      this.boneFrom[name] = new THREE.Vector3(...p);
      this.boneTo[name] = new THREE.Vector3(...p);
    }

    this.pose = DEFAULT_POSE;
    this.transitioning = false;
    this.transitionStart = 0;
    this.transitionDuration = POSE_TRANSITION_SECONDS;
    this.stretchReturnAt = null;

    this.lineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color('#7fe7ff'),
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this._buildTubes();
    this._buildHead();
    this._buildEars();
    this._buildEyes();

    this.breathPhase = Math.random() * Math.PI * 2;
    this.tailPhase = Math.random() * Math.PI * 2;
    this.earTwitch = {
      earL: { next: 3 + Math.random() * 4, phase: 0, active: false },
      earR: { next: 5 + Math.random() * 4, phase: 0, active: false },
    };
    this.shimmerAmount = SHIMMER.base;
    this._shimmerTarget = SHIMMER.base;
  }

  _buildTubes() {
    this.tubes = TUBE_LINKS.map(([a, b]) => {
      const seg = new TubeSegment(a, b, BONE_RADIUS[a], BONE_RADIUS[b]);
      seg.lines.material = this.lineMaterial;
      this.group.add(seg.lines);
      return seg;
    });
  }

  _wireframeMesh(geometry) {
    const wire = new THREE.WireframeGeometry(geometry);
    return new THREE.LineSegments(wire, this.lineMaterial);
  }

  _buildHead() {
    const headGeo = new THREE.IcosahedronGeometry(BONE_RADIUS.head, 1);
    headGeo.scale(1, 0.92, 1.15);
    this.headMesh = this._wireframeMesh(headGeo);
    this.group.add(this.headMesh);

    const noseGeo = new THREE.IcosahedronGeometry(BONE_RADIUS.muzzle * 0.6, 0);
    this.noseMesh = this._wireframeMesh(noseGeo);
    this.group.add(this.noseMesh);
  }

  _buildEars() {
    this.ears = {};
    for (const side of ['earL', 'earR']) {
      const earGeo = new THREE.ConeGeometry(BONE_RADIUS[side] * 1.5, 0.35, 4);
      earGeo.translate(0, 0.175, 0); // base at local origin, tip toward +Y
      const mesh = this._wireframeMesh(earGeo);
      this.group.add(mesh);
      this.ears[side] = mesh;
    }
  }

  _buildEyes() {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(200,245,255,0.9)');
    grad.addColorStop(1, 'rgba(160,230,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);

    const positions = new Float32Array([
      -0.095, 0.02, 0.19,
      0.095, 0.02, 0.19,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.1,
      map: tex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: new THREE.Color('#eaffff'),
    });
    this.eyePoints = new THREE.Points(geo, mat);
    this.group.add(this.eyePoints);
  }

  triggerPose(name, elapsed) {
    if (!POSES[name]) return;
    if (this.pose === name && !this.transitioning) {
      if (name === 'stretch') this.stretchReturnAt = elapsed + STRETCH_HOLD_SECONDS;
      return;
    }
    for (const bname of this.boneNames) {
      this.boneFrom[bname].copy(this.boneCurrent[bname]);
      this.boneTo[bname].set(...POSES[name][bname]);
    }
    this.pose = name;
    this.transitionStart = elapsed;
    this.transitioning = true;
    this.stretchReturnAt = name === 'stretch'
      ? elapsed + this.transitionDuration + STRETCH_HOLD_SECONDS
      : null;
  }

  setShimmerTarget(amount) {
    this._shimmerTarget = amount;
  }

  update(dt, elapsed) {
    if (this.transitioning) {
      const t = THREE.MathUtils.clamp((elapsed - this.transitionStart) / this.transitionDuration, 0, 1);
      const e = easeInOutCubic(t);
      for (const name of this.boneNames) {
        this.boneCurrent[name].lerpVectors(this.boneFrom[name], this.boneTo[name], e);
      }
      if (t >= 1) this.transitioning = false;
    }

    if (this.pose === 'stretch' && !this.transitioning && this.stretchReturnAt !== null && elapsed >= this.stretchReturnAt) {
      this.stretchReturnAt = null;
      this.triggerPose('idle', elapsed);
    }

    this.shimmerAmount += (this._shimmerTarget - this.shimmerAmount) * Math.min(1, dt * 2);

    this.breathPhase += dt * 1.1;
    this.tailPhase += dt * 0.6;
    const breath = Math.sin(this.breathPhase) * 0.02;
    const tailSway = Math.sin(this.tailPhase) * 0.06;

    for (const key of ['earL', 'earR']) {
      const tw = this.earTwitch[key];
      tw.next -= dt;
      if (!tw.active && tw.next <= 0) {
        tw.active = true;
        tw.phase = 0;
        tw.next = 5 + Math.random() * 6;
      }
      if (tw.active) {
        tw.phase += dt * 6;
        if (tw.phase >= Math.PI) tw.active = false;
      }
    }

    // tail sway nudges the current bone position directly before tubes read it
    const tailMid = this.boneCurrent.tailMid;
    const tailTip = this.boneCurrent.tailTip;
    const swayMid = new THREE.Vector3(tailMid.x + tailSway, tailMid.y, tailMid.z);
    const swayTip = new THREE.Vector3(tailTip.x + tailSway * 1.4, tailTip.y, tailTip.z);

    const shimmerSeed = elapsed * SHIMMER.speed;
    for (const seg of this.tubes) {
      let a = this.boneCurrent[seg.boneA];
      let b = this.boneCurrent[seg.boneB];
      if (seg.boneA === 'tailMid') a = swayMid; else if (seg.boneA === 'tailTip') a = swayTip;
      if (seg.boneB === 'tailMid') b = swayMid; else if (seg.boneB === 'tailTip') b = swayTip;

      const scaleA = (seg.boneA === 'chestFront' || seg.boneA === 'spineMid') ? 1 + breath : 1;
      const scaleB = (seg.boneB === 'chestFront' || seg.boneB === 'spineMid') ? 1 + breath : 1;
      seg.update(a, b, this.shimmerAmount, shimmerSeed + seg.boneA.length, scaleA, scaleB);
    }

    const headPos = this.boneCurrent.head;
    const muzzlePos = this.boneCurrent.muzzle;
    this.headMesh.position.copy(headPos);
    const lookDir = new THREE.Vector3().subVectors(muzzlePos, headPos).normalize();
    this.headMesh.quaternion.setFromUnitVectors(FORWARD, lookDir);

    this.noseMesh.position.copy(muzzlePos);

    for (const side of ['earL', 'earR']) {
      const earPos = this.boneCurrent[side];
      const dir = new THREE.Vector3().subVectors(earPos, headPos);
      const dist = dir.length();
      dir.normalize();
      const mesh = this.ears[side];
      mesh.position.copy(headPos).addScaledVector(dir, BONE_RADIUS.head * 0.55);
      mesh.quaternion.setFromUnitVectors(UP, dir);
      mesh.scale.set(1, Math.max(0.4, (dist - BONE_RADIUS.head * 0.4) / 0.35), 1);

      const tw = this.earTwitch[side];
      if (tw.active) {
        const bend = Math.sin(tw.phase) * 0.4 * (side === 'earL' ? 1 : -1);
        mesh.rotateZ(bend);
      }
    }

    this.eyePoints.position.copy(headPos);
    this.eyePoints.quaternion.copy(this.headMesh.quaternion);
  }
}
