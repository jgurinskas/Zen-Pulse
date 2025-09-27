/*
 * Minimal WebAudio controller for Zen Pulse.
 * - Lazily creates an AudioContext on first user gesture
 * - Provides small tone helpers (tick, chime, thud)
 * - Always respect mute flag and ensures cleanup on dispose
 */

const BASE_GAIN = 0.15;

export type ToneType = 'perfect' | 'great' | 'good' | 'miss' | 'tick';

export interface AudioApi {
  setMuted: (muted: boolean) => void;
  toggleMuted: () => boolean;
  playTone: (type: ToneType) => void;
  dispose: () => void;
  isMuted: () => boolean;
}

function frequencyFor(type: ToneType): number {
  switch (type) {
    case 'perfect':
      return 880;
    case 'great':
      return 660;
    case 'good':
      return 520;
    case 'tick':
      return 440;
    case 'miss':
    default:
      return 220;
  }
}

export function createAudioManager(startMuted = true): AudioApi {
  let context: AudioContext | null = null;
  let gainNode: GainNode | null = null;
  let muted = startMuted;

  const ensureContext = () => {
    if (muted) return null; // do not create context while muted
    if (!context) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
      gainNode = context.createGain();
      gainNode.gain.value = BASE_GAIN;
      gainNode.connect(context.destination);
    }
    if (context?.state === 'suspended') {
      context.resume().catch(() => void 0);
    }
    return context;
  };

  const api: AudioApi = {
    setMuted(next) {
      muted = next;
      if (muted) {
        gainNode?.disconnect();
      } else {
        const ctx = ensureContext();
        if (ctx && gainNode && gainNode.numberOfOutputs === 0) {
          gainNode.connect(ctx.destination);
        }
      }
    },
    toggleMuted() {
      api.setMuted(!muted);
      return muted;
    },
    playTone(type: ToneType) {
      const ctx = ensureContext();
      if (!ctx || !gainNode || muted) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequencyFor(type);
      const duration = type === 'miss' ? 0.35 : 0.18;
      const now = ctx.currentTime;
      gain.gain.value = type === 'miss' ? 0.2 : 0.5;
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(gainNode);
      osc.start(now);
      osc.stop(now + duration + 0.05);
      osc.onended = () => {
        gain.disconnect();
        osc.disconnect();
      };
    },
    dispose() {
      if (gainNode) {
        try {
          gainNode.disconnect();
        } catch {
          // ignore
        }
        gainNode = null;
      }
      if (context) {
        context.close().catch(() => void 0);
        context = null;
      }
    },
    isMuted() {
      return muted;
    },
  };

  return api;
}
