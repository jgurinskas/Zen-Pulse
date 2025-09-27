import { useCallback, useEffect, useReducer, useRef } from 'react';
import { createZenPulseEngine } from './engine';
import { createAudioManager, ToneType } from './audio';
import {
  defaultSettings,
  hasStoredSettings,
  loadSettings,
  loadStats,
  saveSettings,
  saveStats,
} from './store';
import {
  EngineApi,
  EngineTapResult,
  GamePhase,
  HitRating,
  LifetimeStats,
  PersistedSettings,
  RoundConfig,
  ScoreTally,
} from './types';

const ROUND_TIME = 90;
const PERFECT_WINDOW = 0.0175;
const FOCUS_PERFECT_WINDOW = 0.012;
const GREAT_WINDOW = 0.04;
const GOOD_WINDOW = 0.07;

interface LastResult {
  rating: HitRating;
  distance: number;
  points: number;
  focus: boolean;
  shieldUsed?: boolean;
}

interface ZenPulseState {
  phase: GamePhase;
  timeLeft: number;
  roundIndex: number;
  currentRound: RoundConfig | null;
  session: ScoreTally;
  bestScore: number;
  stats: LifetimeStats;
  settings: PersistedSettings;
  overlayDismissed: boolean;
  lastResult: LastResult | null;
  shieldFlashId: number;
  hintRoundsRemaining: number;
}

type Action =
  | { type: 'INIT'; settings: PersistedSettings; stats: LifetimeStats }
  | { type: 'START'; round: RoundConfig }
  | { type: 'TICK'; delta: number }
  | {
      type: 'ROUND_RESULT';
      nextRound: RoundConfig;
      rating: HitRating;
      basePoints: number;
      distance: number;
      focus: boolean;
      shieldUsed: boolean;
    }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'END' }
  | { type: 'RESTART' }
  | { type: 'SET_MUTED'; muted: boolean }
  | { type: 'SET_CALM'; calm: boolean }
  | { type: 'SET_SHOW_HINT'; showHint: boolean }
  | { type: 'DISMISS_OVERLAY' };

const createSession = (): ScoreTally => ({
  score: 0,
  streak: 0,
  multiplier: 1,
  shield: 0,
  perfects: 0,
  hits: 0,
  attempts: 0,
  longestStreak: 0,
});

const baseState: ZenPulseState = {
  phase: 'ready',
  timeLeft: ROUND_TIME,
  roundIndex: 0,
  currentRound: null,
  session: createSession(),
  bestScore: 0,
  stats: {
    plays: 0,
    perfects: 0,
    hits: 0,
    attempts: 0,
    longestStreak: 0,
    bestScore: 0,
  },
  settings: defaultSettings,
  overlayDismissed: false,
  lastResult: null,
  shieldFlashId: 0,
  hintRoundsRemaining: defaultSettings.showHint ? 3 : 0,
};

function generateRound(roundIndex: number): RoundConfig {
  const baseSpeed = 0.42;
  const difficultyStep = Math.min(0.3, Math.floor((roundIndex - 1) / 5) * 0.02);
  let speed = baseSpeed * (1 + difficultyStep);
  const focus = roundIndex > 2 && Math.random() < 0.18;
  if (focus) {
    speed *= 0.75;
  }
  const target = 0.22 + Math.random() * (0.78 - 0.22);
  return {
    id: roundIndex,
    target,
    speed: Math.min(0.85, speed),
    focus,
  };
}

function evaluateHit(
  state: ZenPulseState,
  tap: EngineTapResult
): { rating: HitRating; basePoints: number; shieldUsed: boolean } {
  const windowPerfect = tap.focus ? FOCUS_PERFECT_WINDOW : PERFECT_WINDOW;
  const distance = tap.distance;
  let rating: HitRating;
  if (distance <= windowPerfect) {
    rating = 'perfect';
  } else if (distance <= GREAT_WINDOW) {
    rating = 'great';
  } else if (distance <= GOOD_WINDOW) {
    rating = 'good';
  } else {
    rating = 'miss';
  }

  let shieldUsed = false;
  if (rating === 'miss' && state.session.shield > 0) {
    rating = 'good';
    shieldUsed = true;
  }

  let basePoints = 0;
  switch (rating) {
    case 'perfect':
      basePoints = tap.focus ? 150 : 100;
      break;
    case 'great':
      basePoints = 70;
      break;
    case 'good':
      basePoints = 40;
      break;
    case 'miss':
    default:
      basePoints = 0;
  }

  return { rating, basePoints, shieldUsed };
}

function finalize(state: ZenPulseState): ZenPulseState {
  if (state.phase === 'gameover') return state;
  const finalScore = state.session.score;
  const best = Math.max(state.bestScore, finalScore);
  const stats: LifetimeStats = {
    plays: state.stats.plays + 1,
    perfects: state.stats.perfects + state.session.perfects,
    hits: state.stats.hits + state.session.hits,
    attempts: state.stats.attempts + state.session.attempts,
    longestStreak: Math.max(state.stats.longestStreak, state.session.longestStreak),
    bestScore: Math.max(state.stats.bestScore, best),
  };
  return {
    ...state,
    phase: 'gameover',
    currentRound: null,
    timeLeft: 0,
    stats,
    bestScore: best,
  };
}

function reducer(state: ZenPulseState, action: Action): ZenPulseState {
  switch (action.type) {
    case 'INIT':
      return {
        ...state,
        settings: action.settings,
        stats: action.stats,
        bestScore: action.stats.bestScore,
        hintRoundsRemaining: action.settings.showHint ? 3 : 0,
      };
    case 'START':
      return {
        ...state,
        phase: 'playing',
        timeLeft: ROUND_TIME,
        roundIndex: action.round.id,
        currentRound: action.round,
        session: createSession(),
        lastResult: null,
        shieldFlashId: 0,
        hintRoundsRemaining: state.settings.showHint ? 3 : 0,
        overlayDismissed: true,
      };
    case 'TICK': {
      if (state.phase !== 'playing') return state;
      const nextTime = Math.max(0, state.timeLeft - action.delta);
      if (nextTime <= 0) {
        return finalize({ ...state, timeLeft: 0 });
      }
      return { ...state, timeLeft: nextTime };
    }
    case 'ROUND_RESULT': {
      if (state.phase !== 'playing') return state;
      const attempts = state.session.attempts + 1;
      const isHit = action.rating !== 'miss';
      const streak = isHit ? state.session.streak + 1 : 0;
      const multiplier = isHit ? 1 + Math.floor(streak / 10) : 1;
      const hits = state.session.hits + (isHit ? 1 : 0);
      const perfects = state.session.perfects + (action.rating === 'perfect' ? 1 : 0);
      const longestStreak = Math.max(state.session.longestStreak, streak);
      let shield = state.session.shield;
      let shieldFlashId = state.shieldFlashId;
      if (action.shieldUsed) {
        shield = 0;
        shieldFlashId += 1;
      }
      if (isHit && streak > 0 && streak % 10 === 0 && shield < 1) {
        shield = 1;
        shieldFlashId += 1;
      }
      const pointsEarned = action.basePoints * (isHit ? multiplier : 1);
      const score = state.session.score + pointsEarned;
      return {
        ...state,
        roundIndex: state.roundIndex + 1,
        currentRound: action.nextRound,
        session: {
          score,
          streak,
          multiplier,
          shield,
          perfects,
          hits,
          attempts,
          longestStreak,
        },
        lastResult: {
          rating: action.rating,
          distance: action.distance,
          points: pointsEarned,
          focus: action.focus,
          shieldUsed: action.shieldUsed,
        },
        hintRoundsRemaining: Math.max(0, state.hintRoundsRemaining - 1),
        shieldFlashId,
      };
    }
    case 'PAUSE':
      if (state.phase !== 'playing') return state;
      return { ...state, phase: 'paused' };
    case 'RESUME':
      if (state.phase !== 'paused') return state;
      return { ...state, phase: 'playing' };
    case 'END':
      return finalize(state);
    case 'RESTART':
      return {
        ...state,
        phase: 'ready',
        timeLeft: ROUND_TIME,
        roundIndex: 0,
        currentRound: null,
        session: createSession(),
        lastResult: null,
        shieldFlashId: 0,
        hintRoundsRemaining: state.settings.showHint ? 3 : 0,
      };
    case 'SET_MUTED':
      return { ...state, settings: { ...state.settings, muted: action.muted } };
    case 'SET_CALM':
      return { ...state, settings: { ...state.settings, calmMode: action.calm } };
    case 'SET_SHOW_HINT':
      return {
        ...state,
        settings: { ...state.settings, showHint: action.showHint },
        hintRoundsRemaining: action.showHint ? Math.max(state.hintRoundsRemaining, 3) : 0,
      };
    case 'DISMISS_OVERLAY':
      return state.overlayDismissed ? state : { ...state, overlayDismissed: true };
    default:
      return state;
  }
}

function toneForRating(rating: HitRating): ToneType {
  switch (rating) {
    case 'perfect':
      return 'perfect';
    case 'great':
      return 'great';
    case 'good':
      return 'good';
    case 'miss':
    default:
      return 'miss';
  }
}

export interface ZenPulseController {
  state: ZenPulseState;
  start: () => void;
  tap: () => void;
  pause: () => void;
  resume: () => void;
  end: () => void;
  restart: () => void;
  setMuted: (muted: boolean) => void;
  setCalmMode: (calm: boolean) => void;
  setShowHint: (show: boolean) => void;
  dismissOverlay: () => void;
  attach: (canvas: HTMLCanvasElement) => EngineApi;
  flashShield: () => void;
  audio: ReturnType<typeof createAudioManager>;
}

export function useZenPulse(startMuted = true): ZenPulseController {
  const [state, dispatch] = useReducer(reducer, baseState, () => {
    if (typeof window === 'undefined') {
      return {
        ...baseState,
        settings: { ...baseState.settings, muted: startMuted },
      };
    }
    const stored = loadSettings();
    const stats = loadStats();
    const settings = hasStoredSettings()
      ? stored
      : { ...stored, muted: startMuted };
    return {
      ...baseState,
      settings,
      stats,
      bestScore: stats.bestScore,
      hintRoundsRemaining: settings.showHint ? 3 : 0,
    };
  });

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const engineRef = useRef<EngineApi | null>(null);
  const audioRef = useRef(createAudioManager(startMuted));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = loadSettings();
    const settings = hasStoredSettings()
      ? stored
      : { ...stored, muted: startMuted };
    const stats = loadStats();
    dispatch({ type: 'INIT', settings, stats });
  }, [startMuted]);

  useEffect(() => {
    saveSettings(state.settings);
  }, [state.settings]);

  useEffect(() => {
    if (state.phase === 'gameover') {
      saveStats(state.stats);
    }
  }, [state.phase, state.stats]);

  useEffect(() => {
    audioRef.current.setMuted(state.settings.muted);
  }, [state.settings.muted]);

  useEffect(() => {
    engineRef.current?.setCalmMode(state.settings.calmMode);
  }, [state.settings.calmMode]);

  useEffect(() => {
    const phase = state.phase;
    if (phase === 'playing') {
      engineRef.current?.setPaused(false);
    } else {
      engineRef.current?.setPaused(true);
    }
  }, [state.phase]);

  const beginRound = useCallback((round: RoundConfig) => {
    engineRef.current?.beginRound(round);
  }, []);

  const attach = useCallback((canvas: HTMLCanvasElement) => {
    const engine = createZenPulseEngine(canvas, {
      calm: stateRef.current.settings.calmMode,
      onFrame: (deltaMs: number) => {
        const current = stateRef.current;
        if (current.phase === 'playing') {
          dispatch({ type: 'TICK', delta: deltaMs / 1000 });
        }
      },
      onAutoMiss: (tapResult: EngineTapResult) => {
        const current = stateRef.current;
        const { rating, basePoints, shieldUsed } = evaluateHit(current, tapResult);
        const nextRound = generateRound(current.roundIndex + 1);
        dispatch({
          type: 'ROUND_RESULT',
          nextRound,
          rating,
          basePoints,
          distance: tapResult.distance,
          focus: tapResult.focus,
          shieldUsed,
        });
        beginRound(nextRound);
        if (!current.settings.muted) {
          audioRef.current.playTone(toneForRating(rating));
        }
      },
    });
    engineRef.current = engine;
    if (stateRef.current.phase !== 'playing') {
      engine.setPaused(true);
    }
    return engine;
  }, [beginRound]);

  const start = useCallback(() => {
    const next = generateRound(1);
    dispatch({ type: 'START', round: next });
    dispatch({ type: 'DISMISS_OVERLAY' });
    beginRound(next);
    engineRef.current?.setPaused(false);
  }, [beginRound]);

  const tap = useCallback(() => {
    const current = stateRef.current;
    if (current.phase === 'ready') {
      start();
      return;
    }
    dispatch({ type: 'DISMISS_OVERLAY' });
    if (current.phase !== 'playing') return;
    const tapResult = engineRef.current?.tap();
    if (!tapResult) return;
    const { rating, basePoints, shieldUsed } = evaluateHit(current, tapResult);
    const nextRound = generateRound(current.roundIndex + 1);
    dispatch({
      type: 'ROUND_RESULT',
      nextRound,
      rating,
      basePoints,
      distance: tapResult.distance,
      focus: tapResult.focus,
      shieldUsed,
    });
    beginRound(nextRound);
    if (!current.settings.muted) {
      audioRef.current.playTone(toneForRating(rating));
    }
  }, [beginRound, start]);

  const pause = useCallback(() => {
    dispatch({ type: 'PAUSE' });
    engineRef.current?.setPaused(true);
  }, []);

  const resume = useCallback(() => {
    dispatch({ type: 'RESUME' });
    engineRef.current?.setPaused(false);
  }, []);

  const end = useCallback(() => {
    dispatch({ type: 'END' });
    engineRef.current?.setPaused(true);
  }, []);

  const restart = useCallback(() => {
    dispatch({ type: 'RESTART' });
    engineRef.current?.setPaused(true);
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    dispatch({ type: 'SET_MUTED', muted });
  }, []);

  const setCalmMode = useCallback((calm: boolean) => {
    dispatch({ type: 'SET_CALM', calm });
    engineRef.current?.setCalmMode(calm);
  }, []);

  const setShowHint = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_HINT', showHint: show });
  }, []);

  const dismissOverlay = useCallback(() => {
    dispatch({ type: 'DISMISS_OVERLAY' });
  }, []);

  const flashShield = useCallback(() => {
    engineRef.current?.flashShield();
  }, []);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      audioRef.current.dispose();
    };
  }, []);

  return {
    state,
    start,
    tap,
    pause,
    resume,
    end,
    restart,
    setMuted,
    setCalmMode,
    setShowHint,
    dismissOverlay,
    attach,
    flashShield,
    audio: audioRef.current,
  };
}
