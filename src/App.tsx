import React, { Suspense, useState } from 'react';

const LazyZenPulse = React.lazy(() =>
  import('./games/zen-pulse').then((m) => ({ default: m.ZenPulse }))
);

export default function App() {
  const [showGame, setShowGame] = useState(true);
  return (
    <div className="mx-auto flex min-h-screen max-w-screen-md flex-col gap-6 bg-slate-950 p-4 text-white">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Zen Pulse Demo</h1>
        <p className="text-sm text-white/70">
          Tap when the pulse meets the halo. This demo renders the standalone Zen Pulse bundle inside a
          Tailwind-enabled React container.
        </p>
      </header>
      <main className="flex-1">
        {!showGame && (
          <button
            onClick={() => setShowGame(true)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/80 shadow hover:bg-white/10"
          >
            Launch Zen Pulse
          </button>
        )}
        {showGame && (
          <div className="relative h-[min(70vh,480px)] w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-inner">
            <Suspense fallback={<div className="grid h-full place-items-center text-sm">Loading…</div>}>
              <LazyZenPulse onExit={() => setShowGame(false)} />
            </Suspense>
          </div>
        )}
      </main>
      <footer className="text-xs text-white/50">Press Space/Enter to tap. P pauses, R restarts.</footer>
    </div>
  );
}
