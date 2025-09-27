export type GamePhase = 'ready' | 'playing' | 'paused' | 'gameover';

export type HitRating = 'perfect' | 'great' | 'good' | 'miss';

export interface RoundConfig {
  /** Identifier incremented every round so effects can react */
  id: number;
  /** Target halo radius as a fraction of the minimum viewport dimension */
  target: number;
  /** Pixels per second growth speed in normalized space (0-1) */
  speed: number;
  /** Whether the round is a focus round (tighter window, more points) */
  focus: boolean;
}

export interface ScoreTally {
  score: number;
  streak: number;
  multiplier: number;
  shield: number;
  perfects: number;
  hits: number;
  attempts: number;
  longestStreak: number;
}

export interface LifetimeStats {
  plays: number;
  perfects: number;
  hits: number;
  attempts: number;
  longestStreak: number;
  bestScore: number;
}

export interface PersistedSettings {
  muted: boolean;
  calmMode: boolean;
  showHint: boolean;
}

export interface EngineFrame {
  deltaMs: number;
  timestamp: number;
  radius: number;
}

export interface EngineTapResult {
  radius: number;
  target: number;
  distance: number;
  focus: boolean;
}

export interface EngineApi {
  beginRound: (round: RoundConfig) => void;
  tap: () => EngineTapResult | null;
  setPaused: (paused: boolean) => void;
  setCalmMode: (calm: boolean) => void;
  dispose: () => void;
  isReady: () => boolean;
}
