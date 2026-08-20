import * as THREE from 'three';
import { POSES, BONE_ORDER, BONE_LINKS } from './poses.js';
import { SHIMMER, POSE_TRANSITION_SECONDS, STRETCH_HOLD_SECONDS, DEFAULT_POSE } from './config.js';

// Particle count / spread per bone anchor. `eyeSlots` carves out the first
// N particles of that bone as small bright "eye" points at a fixed local
// offset instead of a random cloud position.
const BONE_DEFS = [
  { name: 'earL', count: 14, radius: 0.075 },
  { name: 'earR', count: 14, radius: 0.075 },
  { name: 'head', count: 70, radius: 0.24, eyeSlots: 2, eyeOffsetX: 0.095, eyeOffsetY: 0.02, eyeOffsetZ: 0.185 },
  { name: 'muzzle', count: 18, radius: 0.1 },
  { name: 'neck', count: 26, radius: 0.16 },
  { name: 'chestFront', count: 50, radius: 0.26 },
  { name: 'spineMid', count: 46, radius: 0.23 },
  { name: 'hip', count: 50, radius: 0.26 },
  { name: 'tailBase', count: 16, radius: 0.1 },
  { name: 'tailMid', count: 16, radius: 0.08 },
  { name: 'tailTip', count: 14, radius: 0.06 },
  { name: 'legFL', count: 18, radius: 0.065 },
  { name: 'legFR', count: 18, radius: 0.065 },
  { name: 'legBL', count: 18, radius: 0.065 },
  { name: 'legBR', count: 18, radius: 0.065 },
  { name: 'pawFL', count: 12, radius: 0.075 },
  { name: 'pawFR', count: 12, radius: 0.075 },
  { name: 'pawBL', count: 12, radius: 0.075 },
  { name: 'pawBR', count: 12, radius: 0.075 },
];

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function makeGlowSprite() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(160,235,255,0.9)');
  grad.addColorStop(1, 'rgba(120,220,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export class CatParticles {
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

    this._buildParticles();
    this._buildLines();

    this.breathPhase = Math.random() * Math.PI * 2;
    this.tailPhase = Math.random() * Math.PI * 2;
    this.earTwitch = {
      earL: { next: 3 + Math.random() * 4, phase: 0, active: false },
      earR: { next: 5 + Math.random() * 4, phase: 0, active: false },
    };
    this.shimmerAmount = SHIMMER.base;
    this._shimmerTarget = SHIMMER.base;
  }

  _buildParticles() {
    const positions = [];
    const colors = [];
    const sizes = [];
    this.particleBones = [];
    this.particleLocalOffset = [];
    this.particleSeed = [];

    const baseColor = new THREE.Color('#7fe7ff');
    const eyeColor = new THREE.Color('#eaffff');

    for (const bone of BONE_DEFS) {
      for (let i = 0; i < bone.count; i++) {
        const isEye = bone.eyeSlots && i < bone.eyeSlots;
        let localOffset;

        if (isEye) {
          const side = i === 0 ? -1 : 1;
          localOffset = new THREE.Vector3(
            side * bone.eyeOffsetX + (Math.random() - 0.5) * 0.015,
            bone.eyeOffsetY + (Math.random() - 0.5) * 0.015,
            bone.eyeOffsetZ + (Math.random() - 0.5) * 0.015
          );
        } else {
          const dir = new THREE.Vector3(
            Math.random() * 2 - 1,
            Math.random() * 2 - 1,
            Math.random() * 2 - 1
          );
          if (dir.lengthSq() < 0.0001) dir.set(0, 1, 0);
          dir.normalize().multiplyScalar(bone.radius * Math.cbrt(Math.random()));
          localOffset = dir;
        }

        this.particleBones.push(bone.name);
        this.particleLocalOffset.push(localOffset);
        this.particleSeed.push(Math.random() * 1000);

        positions.push(0, 0, 0);
        const c = isEye ? eyeColor : baseColor;
        const flicker = 0.85 + Math.random() * 0.15;
        colors.push(c.r * flicker, c.g * flicker, c.b * flicker);
        sizes.push(isEye ? 0.05 + Math.random() * 0.02 : 0.045 + Math.random() * 0.05);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.09,
      map: makeGlowSprite(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geo, material);
    this.group.add(this.points);
  }

  _buildLines() {
    const positions = [];
    for (let i = 0; i < BONE_LINKS.length; i++) positions.push(0, 0, 0, 0, 0, 0);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color('#7fe7ff'),
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.lines = new THREE.LineSegments(geo, material);
    this.group.add(this.lines);
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

    const positions = this.points.geometry.attributes.position.array;
    for (let i = 0; i < this.particleBones.length; i++) {
      const bone = this.particleBones[i];
      const base = this.boneCurrent[bone];
      const off = this.particleLocalOffset[i];
      const seed = this.particleSeed[i];

      let x = base.x + off.x;
      let y = base.y + off.y;
      let z = base.z + off.z;

      if (bone === 'chestFront' || bone === 'spineMid') {
        const scale = 1 + breath * (bone === 'chestFront' ? 1 : 0.5);
        x = base.x + off.x * scale;
        y = base.y + off.y * scale;
        z = base.z + off.z * scale + breath * 0.4;
      }
      if (bone === 'tailMid' || bone === 'tailTip') {
        x += tailSway * (bone === 'tailTip' ? 1.4 : 1);
      }
      if (bone === 'earL' || bone === 'earR') {
        const tw = this.earTwitch[bone];
        if (tw.active) {
          const bend = Math.sin(tw.phase) * 0.12;
          z += bend;
          y += bend * 0.5;
        }
      }

      if (this.shimmerAmount > 0.0001) {
        const jt = elapsed * SHIMMER.speed + seed;
        x += Math.sin(jt) * this.shimmerAmount;
        y += Math.cos(jt * 1.3) * this.shimmerAmount;
        z += Math.sin(jt * 0.7 + 1.5) * this.shimmerAmount;
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    this.points.geometry.attributes.position.needsUpdate = true;

    const linePositions = this.lines.geometry.attributes.position.array;
    for (let i = 0; i < BONE_LINKS.length; i++) {
      const [a, b] = BONE_LINKS[i];
      const pa = this.boneCurrent[a];
      const pb = this.boneCurrent[b];
      const idx = i * 6;
      linePositions[idx] = pa.x; linePositions[idx + 1] = pa.y; linePositions[idx + 2] = pa.z;
      linePositions[idx + 3] = pb.x; linePositions[idx + 4] = pb.y; linePositions[idx + 5] = pb.z;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
}
