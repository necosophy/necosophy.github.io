import { PURR } from './config.js';

// Fully synthesized purr: a soft filtered-noise + low rumble oscillator
// layer, both amplitude-modulated at a purr-like rate (~20-30Hz) via an
// LFO driving the shared output gain's AudioParam. No samples involved.
export class PurrSynth {
  constructor() {
    this.ctx = null;
    this.active = false;
    this.chirping = false;
    this._baseRate = PURR.ampModRateHz;
    this._baseFilter = 360;
  }

  ensureContext() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this._buildGraph();
  }

  resume() {
    this.ensureContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _makeNoiseBuffer() {
    const duration = 2;
    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // brownian-ish smoothing, softer than raw white noise
      data[i] = last * 3.5;
    }
    return buffer;
  }

  _buildGraph() {
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    this.noiseSource = ctx.createBufferSource();
    this.noiseSource.buffer = this._makeNoiseBuffer();
    this.noiseSource.loop = true;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'bandpass';
    this.filter.frequency.value = this._baseFilter;
    this.filter.Q.value = 0.7;

    this.ampGain = ctx.createGain();
    this.ampGain.gain.value = 0.5; // base level; oscillates around this via the LFO below

    this.noiseSource.connect(this.filter);
    this.filter.connect(this.ampGain);

    this.rumbleOsc = ctx.createOscillator();
    this.rumbleOsc.type = 'sine';
    this.rumbleOsc.frequency.value = 100;
    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0.35;
    this.rumbleOsc.connect(this.rumbleGain);
    this.rumbleGain.connect(this.ampGain);

    this.ampGain.connect(this.master);

    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = this._baseRate;
    this.lfoDepth = ctx.createGain();
    this.lfoDepth.gain.value = 0.5;
    this.lfo.connect(this.lfoDepth);
    this.lfoDepth.connect(this.ampGain.gain);

    this.noiseSource.start();
    this.rumbleOsc.start();
    this.lfo.start();
  }

  trigger(pose, velocity) {
    this.resume();
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const timbre = PURR.poseTimbre[pose];
    if (!timbre) return;
    const vNorm = Math.max(0, Math.min(127, velocity)) / 127;

    if (timbre.chirp) {
      this._fadeMasterTo(0, PURR.fadeOutSeconds * 0.5);
      this.chirping = true;
      this.active = false;
      this._playChirp(vNorm, timbre);
      return;
    }

    this.chirping = false;
    this.active = true;

    this._baseRate = PURR.ampModRateHz * timbre.rateMul + vNorm * PURR.ampModRateVelocityRange;
    this._baseFilter = timbre.filterFreq * (1 + vNorm * 0.25);

    this.lfo.frequency.cancelScheduledValues(now);
    this.lfo.frequency.setValueAtTime(this.lfo.frequency.value, now);
    this.lfo.frequency.linearRampToValueAtTime(this._baseRate, now + 0.5);

    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setValueAtTime(this.filter.frequency.value, now);
    this.filter.frequency.linearRampToValueAtTime(this._baseFilter, now + 0.5);

    this.rumbleOsc.frequency.cancelScheduledValues(now);
    this.rumbleOsc.frequency.setValueAtTime(this.rumbleOsc.frequency.value, now);
    this.rumbleOsc.frequency.linearRampToValueAtTime(timbre.rumble, now + 0.5);

    const targetVolume = vNorm * PURR.maxVolume;
    this._fadeMasterTo(targetVolume, PURR.fadeInSeconds);
  }

  release() {
    if (!this.active) return;
    this.active = false;
    this._fadeMasterTo(0, PURR.fadeOutSeconds);
  }

  // Other notes played while a purr is sustained gently bend its pitch/rate,
  // then settle back to the pose's base timbre.
  modulateFromNote(note) {
    if (!this.active || this.chirping || !this.ctx) return;
    const now = this.ctx.currentTime;
    const semitoneOffset = Math.max(
      -PURR.pitchBendSemitoneRange,
      Math.min(PURR.pitchBendSemitoneRange, note - 60)
    );
    const ratio = Math.pow(2, semitoneOffset / 12);

    const rateTarget = this._baseRate * ratio;
    this.lfo.frequency.cancelScheduledValues(now);
    this.lfo.frequency.setValueAtTime(this.lfo.frequency.value, now);
    this.lfo.frequency.linearRampToValueAtTime(rateTarget, now + 0.12);
    this.lfo.frequency.setTargetAtTime(this._baseRate, now + 0.12, 0.5);

    const filterTarget = this._baseFilter * ratio;
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setValueAtTime(this.filter.frequency.value, now);
    this.filter.frequency.linearRampToValueAtTime(filterTarget, now + 0.12);
    this.filter.frequency.setTargetAtTime(this._baseFilter, now + 0.12, 0.5);
  }

  _fadeMasterTo(target, seconds) {
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(target, now + seconds);
  }

  _playChirp(vNorm, timbre) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dur = timbre.chirpDuration ?? 0.4;
    const vol = 0.15 + vNorm * 0.35;
    const trillCount = 3;
    const slice = dur / trillCount;

    for (let i = 0; i < trillCount; i++) {
      const start = now + i * slice * 0.9;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.setValueAtTime(timbre.chirpFrom, start);
      osc.frequency.exponentialRampToValueAtTime(timbre.chirpTo, start + slice * 0.8);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + slice * 0.9);

      osc.start(start);
      osc.stop(start + slice + 0.05);
    }
  }
}
