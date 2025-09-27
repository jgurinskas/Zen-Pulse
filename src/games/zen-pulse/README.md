# Zen Pulse

A compact tap-timing experience designed to drop into an existing React + Tailwind environment. The game mounts inside any container, paints its own canvas background/animations, and renders the HUD with Tailwind utility classes.

## Features
- 90 second sessions with a growing pulse you lock in by tapping when it meets the halo.
- Scoring windows (Perfect, Great, Good, Miss) with streak-based multiplier and a Focus Shield granted every 10 hits.
- Occasional Focus Rounds: slower pulses, tighter windows, bonus Perfect value (+150).
- Focus Shield auto-saves the next miss by converting it into a Good.
- Calm Mode toggle and `prefers-reduced-motion` support (background noise/animation muted when enabled).
- WebAudio feedback (Perfect/Great/Good/Miss tones) muted by default, opt-in via HUD toggle.
- Fully keyboard accessible: Space/Enter tap, `P` pause/resume, `R` restart, `Esc` exit.
- Lifetime stats (plays, best score, accuracy, longest streak, perfects) and settings persisted under `qz.zenpulse.*` keys.
- Clean unmount: cancels `requestAnimationFrame`, removes listeners, closes AudioContext.

## Component API
```ts
import { ZenPulse } from '../games/zen-pulse';

<ZenPulse
  title="Zen Pulse"
  onExit={() => setShowZen(false)}
  startMuted={false}
  forceCalmMode={false}
  className="rounded-xl"
/>
```

| Prop | Description |
| --- | --- |
| `title` | Optional label shown in the intro overlay and HUD (default: "Zen Pulse"). |
| `onExit` | Invoked when the user presses the Exit button (or `Esc`). |
| `startMuted` | When `true` the session starts muted (default). Pass `false` to begin with audio on. |
| `forceCalmMode` | Forces calm mode regardless of settings/media queries. |
| `className` | Tailwind classes for the outer wrapper (fills parent by default). |

## Controls & Input
- **Tap/Click/Touch** anywhere inside the component to lock in the ring (entire surface is the tap target).
- **Space / Enter**: tap action when the wrapper has focus.
- **P**: pause/resume.
- **R**: restart the run.
- **Esc**: exit (calls `onExit`).
- HUD buttons provide toggles for exit, mute/unmute, pause/resume, calm mode, and tap hints.

## Integration snippet
```tsx
// src/pages/Games.tsx
import React, { Suspense, useState } from 'react';
const ZenPulse = React.lazy(() => import('../games/zen-pulse').then(m => ({ default: m.ZenPulse })));

export default function Games() {
  const [showZen, setShowZen] = useState(false);
  return (
    <div className="mx-auto max-w-screen-sm p-4">
      {!showZen && (
        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={() => setShowZen(true)}
            className="rounded-xl border border-white/10 bg-white/5 p-5 text-left shadow-sm hover:bg-white/10"
          >
            <div className="text-base font-medium">Zen Pulse</div>
            <div className="text-sm text-white/70">Tap when the pulse meets the halo.</div>
          </button>
          {/* Add Orbit Gate, Drift Stack tiles here */}
        </div>
      )}
      {showZen && (
        <div className="fixed inset-0 z-50">
          <Suspense fallback={<div className="grid h-full place-items-center text-sm">Loading…</div>}>
            <ZenPulse onExit={() => setShowZen(false)} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
```

## File structure
- `index.ts` – export surface for lazy-loading.
- `ZenPulse.tsx` – React component that renders the canvas, HUD, overlays, and manages focus/keyboard input.
- `useZenPulse.ts` – reducer-driven hook orchestrating game state, scoring, persistence, engine/audio coordination.
- `engine.ts` – Canvas 2D renderer/animator, handles ring growth, halo drawing, gradient background, auto-miss detection.
- `audio.ts` – Minimal WebAudio manager (lazy AudioContext, simple oscillator tones, cleanup helpers).
- `store.ts` – LocalStorage helpers for stats/settings (namespaced `qz.zenpulse.*`).
- `types.ts` – Shared interfaces/enums used across the game.

## Notes
- Tailwind utility classes are used exclusively for layout and HUD styling; canvas renders background/animations.
- No global CSS or document-level listeners are introduced. All listeners are scoped and cleaned up on unmount.
- The component respects safe-area insets via inline styles on top/bottom bars.
