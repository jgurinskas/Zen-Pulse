import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useZenPulse } from './useZenPulse';
import {
  loadAutoCalmApplied,
  resetAutoCalmApplied,
  saveAutoCalmApplied,
} from './store';

export type ZenPulseProps = {
  /** Optional title rendered in top bar */
  title?: string;
  /** Called when user taps Exit in HUD or presses Esc */
  onExit?: () => void;
  /** Start muted? default true */
  startMuted?: boolean;
  /** Force calm mode (reduced motion) regardless of media query */
  forceCalmMode?: boolean;
  /** Optional className to style the outer wrapper via Tailwind */
  className?: string;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefers(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return prefers;
}

const formatTime = (seconds: number) => {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60)
    .toString()
    .padStart(1, '0');
  const secs = (clamped % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

const ratingLabels: Record<string, string> = {
  perfect: 'Perfect',
  great: 'Great',
  good: 'Good',
  miss: 'Miss',
};

const ratingColors: Record<string, string> = {
  perfect: 'text-sky-200',
  great: 'text-sky-300',
  good: 'text-white/80',
  miss: 'text-white/60',
};

const ZenPulse: React.FC<ZenPulseProps> = ({
  title = 'Zen Pulse',
  onExit,
  startMuted = true,
  forceCalmMode,
  className,
}) => {
  const controller = useZenPulse(startMuted);
  const {
    state,
    tap,
    start,
    pause,
    resume,
    restart,
    setMuted,
    setCalmMode,
    setShowHint,
    attach,
    flashShield,
  } = controller;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const forcedCalmRef = useRef(false);
  const calmRestoreRef = useRef<boolean | null>(null);
  const autoCalmAppliedRef = useRef(loadAutoCalmApplied());
  const prefersReducedMotion = usePrefersReducedMotion();
  const [shieldHighlight, setShieldHighlight] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = attach(canvas);
    return () => {
      engine.dispose();
    };
  }, [attach]);

  useEffect(() => {
    containerRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!prefersReducedMotion) {
      if (autoCalmAppliedRef.current) {
        autoCalmAppliedRef.current = false;
        resetAutoCalmApplied();
      }
      return;
    }
    if (forceCalmMode) {
      return;
    }
    if (!autoCalmAppliedRef.current) {
      autoCalmAppliedRef.current = true;
      saveAutoCalmApplied(true);
      if (!state.settings.calmMode) {
        setCalmMode(true);
      }
    }
  }, [forceCalmMode, prefersReducedMotion, setCalmMode, state.settings.calmMode]);

  useEffect(() => {
    if (forceCalmMode) {
      if (!forcedCalmRef.current) {
        calmRestoreRef.current = state.settings.calmMode;
        forcedCalmRef.current = true;
      }
      if (!state.settings.calmMode) {
        setCalmMode(true);
      }
    } else if (forcedCalmRef.current) {
      forcedCalmRef.current = false;
      if (calmRestoreRef.current !== null) {
        setCalmMode(calmRestoreRef.current);
      }
      calmRestoreRef.current = null;
    }
  }, [forceCalmMode, setCalmMode, state.settings.calmMode]);

  useEffect(() => {
    if (!state.shieldFlashId) return;
    flashShield();
    setShieldHighlight(true);
    const timer = window.setTimeout(() => setShieldHighlight(false), 420);
    return () => window.clearTimeout(timer);
  }, [flashShield, state.shieldFlashId]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && state.phase === 'playing') {
        pause();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pause, state.phase]);

  const calmActive = Boolean(forceCalmMode || state.settings.calmMode);

  const accuracy = useMemo(() => {
    if (!state.session.attempts) return 0;
    return Math.round((state.session.hits / state.session.attempts) * 100);
  }, [state.session.hits, state.session.attempts]);

  const handleTap = useCallback(() => {
    tap();
  }, [tap]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== containerRef.current) return;
      const key = event.key;
      if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
        event.preventDefault();
        handleTap();
      } else if (key === 'p' || key === 'P') {
        event.preventDefault();
        if (state.phase === 'paused') {
          resume();
        } else if (state.phase === 'playing') {
          pause();
        }
      } else if (key === 'r' || key === 'R') {
        event.preventDefault();
        restart();
      } else if (key === 'Escape') {
        event.preventDefault();
        onExit?.();
      }
    },
    [handleTap, onExit, pause, restart, resume, state.phase]
  );

  const showOverlay = state.phase === 'ready' && !state.overlayDismissed;
  const showHint = state.phase === 'playing' && state.hintRoundsRemaining > 0;
  const shieldActive = state.session.shield > 0;

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      aria-label="Zen Pulse playfield"
      className={cx(
        'relative h-full w-full touch-none select-none overflow-hidden text-white',
        className
      )}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest('[data-control="true"]')) return;
        handleTap();
      }}
      onKeyDown={handleKeyDown}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <header
          className="pointer-events-auto flex items-center justify-between gap-2 px-4 pt-4"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}
        >
          <button
            data-control="true"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onExit?.()}
            className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20"
            aria-label="Exit Zen Pulse"
          >
            <span aria-hidden className="text-lg">
              ←
            </span>
            Exit
          </button>

          <div className="flex flex-col items-center text-center">
            <div className="text-xs uppercase tracking-wide text-white/60">Score</div>
            <div className="text-xl font-semibold tabular-nums">{state.session.score}</div>
            <div className="text-xs text-white/60">×{state.session.multiplier}</div>
            {state.currentRound?.focus && (
              <span className="mt-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sky-200">
                Focus Round
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div
              className={cx(
                'rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm tabular-nums backdrop-blur',
                shieldActive && shieldHighlight
                  ? 'ring-2 ring-sky-300/80 ring-offset-2 ring-offset-white/10'
                  : ''
              )}
            >
              <span className="mr-1 text-white/70">🕒</span>
              {formatTime(state.timeLeft)}
              <span className="ml-2 text-white/70" aria-hidden>
                🛡
              </span>
              <span className="ml-1">{shieldActive ? '1' : '0'}</span>
            </div>

            <button
              data-control="true"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setMuted(!state.settings.muted)}
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 p-2 text-base text-white hover:bg-white/20"
              aria-label={state.settings.muted ? 'Unmute' : 'Mute'}
            >
              <span aria-hidden>{state.settings.muted ? '🔇' : '🔊'}</span>
            </button>

            <button
              data-control="true"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                if (state.phase === 'paused') {
                  resume();
                } else if (state.phase === 'playing') {
                  pause();
                } else if (state.phase === 'ready') {
                  start();
                }
              }}
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 p-2 text-base text-white hover:bg-white/20"
              aria-label={state.phase === 'paused' ? 'Resume' : 'Pause'}
            >
              <span aria-hidden>{state.phase === 'paused' ? '▶' : '⏸'}</span>
            </button>
          </div>
        </header>

        <div className="pointer-events-none flex-1" />

        <footer
          className="pointer-events-auto flex items-end justify-between px-4 pb-6"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)' }}
        >
          <div className="flex flex-col gap-2 text-xs text-white/70">
            <button
              data-control="true"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setCalmMode(!calmActive)}
              disabled={Boolean(forceCalmMode)}
              className={cx(
                'inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-xs',
                'bg-white/10 text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60'
              )}
              aria-pressed={calmActive}
            >
              <span aria-hidden>🌙</span>
              Calm {calmActive ? 'On' : 'Off'}
            </button>
            <label
              data-control="true"
              onPointerDown={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2"
            >
              <input
                data-control="true"
                type="checkbox"
                className="h-4 w-4 rounded border-white/30 bg-transparent"
                checked={state.settings.showHint}
                onChange={(event) => setShowHint(event.target.checked)}
              />
              <span>Show tap hint</span>
            </label>
          </div>

          {showHint && (
            <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center">
              <div className="rounded-full border border-white/30 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
                Tap
              </div>
            </div>
          )}

          {state.lastResult && (
            <div className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-right text-xs">
              <div className={cx('font-semibold uppercase', ratingColors[state.lastResult.rating])}>
                {ratingLabels[state.lastResult.rating]}
              </div>
              <div className="text-white/60">
                Δ {(state.lastResult.distance * 100).toFixed(2)}%
              </div>
              <div className="text-white/60">+{state.lastResult.points}</div>
            </div>
          )}
        </footer>
      </div>

      {showOverlay && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="pointer-events-auto w-[min(90%,20rem)] rounded-3xl border border-white/10 bg-black/50 p-6 text-center backdrop-blur">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-3 text-sm text-white/70">Tap when the pulse meets the halo.</p>
            <button
              data-control="true"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => start()}
              className="mt-6 inline-flex w-full justify-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
            >
              Begin
            </button>
          </div>
        </div>
      )}

      {state.phase === 'paused' && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40 backdrop-blur">
          <div className="pointer-events-auto w-[min(90%,18rem)] rounded-3xl border border-white/10 bg-black/60 p-5 text-center text-sm">
            <h3 className="text-base font-semibold text-white">Paused</h3>
            <div className="mt-4 grid gap-3">
              <button
                data-control="true"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => resume()}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-white hover:bg-white/20"
              >
                Resume
              </button>
              <button
                data-control="true"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => restart()}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-white hover:bg-white/20"
              >
                Restart
              </button>
              <button
                data-control="true"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onExit?.()}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-white hover:bg-white/20"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {state.phase === 'gameover' && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/60 backdrop-blur">
          <div className="pointer-events-auto w-[min(92%,24rem)] rounded-3xl border border-white/10 bg-black/70 p-6 text-center text-sm">
            <h3 className="text-lg font-semibold text-white">Session Complete</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 text-left text-xs uppercase tracking-wide text-white/60">
              <div>
                <div className="text-white/50">Score</div>
                <div className="text-2xl font-semibold text-white tabular-nums">{state.session.score}</div>
              </div>
              <div>
                <div className="text-white/50">Best</div>
                <div className="text-xl font-semibold text-sky-200 tabular-nums">{state.bestScore}</div>
              </div>
              <div>
                <div className="text-white/50">Accuracy</div>
                <div className="text-lg font-semibold text-white tabular-nums">{accuracy}%</div>
              </div>
              <div>
                <div className="text-white/50">Longest Streak</div>
                <div className="text-lg font-semibold text-white tabular-nums">{state.session.longestStreak}</div>
              </div>
              <div>
                <div className="text-white/50">Plays</div>
                <div className="text-lg font-semibold text-white tabular-nums">{state.stats.plays}</div>
              </div>
              <div>
                <div className="text-white/50">Perfects</div>
                <div className="text-lg font-semibold text-white tabular-nums">{state.session.perfects}</div>
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              <button
                data-control="true"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => restart()}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-white hover:bg-white/20"
              >
                Play Again
              </button>
              <button
                data-control="true"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onExit?.()}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-white hover:bg-white/20"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZenPulse;
