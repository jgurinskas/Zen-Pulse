import { EngineApi, EngineTapResult, RoundConfig } from './types';

interface EngineOptions {
  onFrame: (deltaMs: number) => void;
  onAutoMiss: (result: EngineTapResult) => void;
  calm: boolean;
}

const BG_BASE_HUE = 205;

class ZenPulseEngine implements EngineApi {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: EngineOptions;
  private width = 0;
  private height = 0;
  private minDim = 0;
  private raf = 0;
  private running = false;
  private paused = false;
  private lastTs = 0;
  private radius = 0;
  private round: RoundConfig | null = null;
  private hue = BG_BASE_HUE;
  private calm = false;
  private shieldFlashMs = 0;

  constructor(canvas: HTMLCanvasElement, options: EngineOptions) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D context unavailable');
    }
    this.ctx = ctx;
    this.options = options;
    this.calm = options.calm;
    this.handleFrame = this.handleFrame.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleResize();
    window.addEventListener('resize', this.handleResize);
    this.running = true;
    this.raf = requestAnimationFrame(this.handleFrame);
  }

  beginRound(round: RoundConfig) {
    this.round = round;
    this.radius = 0;
    this.lastTs = performance.now();
  }

  tap(): EngineTapResult | null {
    if (!this.round) return null;
    const result: EngineTapResult = {
      radius: this.radius,
      target: this.round.target,
      distance: Math.abs(this.radius - this.round.target),
      focus: this.round.focus,
    };
    this.radius = this.round.target; // snap for visual feedback
    return result;
  }

  setPaused(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      if (this.running) {
        this.running = false;
        cancelAnimationFrame(this.raf);
        this.raf = 0;
      }
      this.drawFrame(0);
    } else if (!this.running) {
      this.running = true;
      this.lastTs = performance.now();
      this.raf = requestAnimationFrame(this.handleFrame);
    }
  }

  setCalmMode(calm: boolean) {
    this.calm = calm;
  }

  flashShield() {
    this.shieldFlashMs = 320;
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.handleResize);
  }

  isReady() {
    return Boolean(this.ctx);
  }

  private handleResize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = width;
    this.height = height;
    this.minDim = Math.min(width, height);
  }

  private handleFrame(timestamp: number) {
    if (!this.running) return;
    const delta = this.lastTs ? timestamp - this.lastTs : 16.7;
    this.lastTs = timestamp;

    if (!this.paused && this.round) {
      const deltaSeconds = delta / 1000;
      const speed = this.round.speed;
      const noise = this.calm ? 0 : Math.sin(timestamp * 0.001 + this.radius * 8) * 0.0025;
      this.radius += speed * deltaSeconds + noise;
      if (this.radius >= 1.05) {
        const result: EngineTapResult = {
          radius: this.radius,
          target: this.round.target,
          distance: Math.abs(this.radius - this.round.target),
          focus: this.round.focus,
        };
        this.round = null;
        this.options.onAutoMiss(result);
      }
    }

    if (this.shieldFlashMs > 0) {
      this.shieldFlashMs = Math.max(0, this.shieldFlashMs - delta);
    }

    this.drawFrame(delta);
    this.options.onFrame(delta);
    if (this.running) {
      this.raf = requestAnimationFrame(this.handleFrame);
    }
  }

  private drawFrame(deltaMs: number) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    const cx = this.width / 2;
    const cy = this.height / 2;
    const minDim = this.minDim;

    // background radial gradient that gently pulses
    const gradient = ctx.createRadialGradient(
      cx,
      cy,
      0,
      cx,
      cy,
      minDim * 0.9
    );
    if (!this.calm) {
      this.hue += deltaMs * 0.0004;
    }
    const hue = (this.hue % 360 + 360) % 360;
    gradient.addColorStop(0, `hsla(${hue}, 70%, 16%, 0.9)`);
    gradient.addColorStop(1, `hsla(${(hue + 40) % 360}, 65%, 8%, 1)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    if (!this.round) {
      return;
    }

    const targetPx = this.round.target * minDim;
    const radiusPx = Math.max(2, this.radius * minDim);

    // target halo
    ctx.save();
    ctx.translate(cx, cy);
    const baseHalo = this.round.focus ? 'rgba(224, 252, 255, 0.9)' : 'rgba(255, 255, 255, 0.45)';
    const flashStrength = this.shieldFlashMs > 0 ? Math.min(1, this.shieldFlashMs / 160) : 0;
    const flashColor = `rgba(165, 243, 252, ${0.35 + flashStrength * 0.5})`;
    ctx.strokeStyle = flashStrength ? flashColor : baseHalo;
    ctx.lineWidth = Math.max(2, minDim * 0.01);
    ctx.beginPath();
    ctx.arc(0, 0, targetPx, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = this.round.focus ? 'rgba(125, 211, 252, 0.45)' : 'rgba(165, 180, 252, 0.25)';
    ctx.lineWidth = Math.max(1, minDim * 0.004);
    ctx.beginPath();
    ctx.arc(0, 0, targetPx + minDim * 0.018, 0, Math.PI * 2);
    ctx.stroke();

    if (flashStrength) {
      const glowRadius = targetPx + minDim * 0.04;
      const gradient = ctx.createRadialGradient(0, 0, targetPx * 0.9, 0, 0, glowRadius);
      gradient.addColorStop(0, `rgba(186, 230, 253, ${0.25 * flashStrength})`);
      gradient.addColorStop(1, 'rgba(186, 230, 253, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // expanding ring
    const opacity = this.paused ? 0.3 : 0.8;
    ctx.strokeStyle = `rgba(226, 243, 255, ${opacity})`;
    ctx.lineWidth = Math.max(2, minDim * 0.02);
    ctx.beginPath();
    ctx.arc(0, 0, radiusPx, 0, Math.PI * 2);
    ctx.stroke();

    if (!this.calm) {
      const sparkCount = 10;
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(226, 243, 255, 0.35)';
      for (let i = 0; i < sparkCount; i += 1) {
        const angle = (i / sparkCount) * Math.PI * 2 + (this.radius * 12);
        const inner = radiusPx - minDim * 0.015;
        const outer = radiusPx + minDim * 0.02;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

export function createZenPulseEngine(
  canvas: HTMLCanvasElement,
  options: EngineOptions
): EngineApi {
  return new ZenPulseEngine(canvas, options);
}
