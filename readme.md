Zen Pulse — Embedded React Game (AEM + Tailwind v4)
A lightweight, calming, one-tap arcade mini-game designed to help users ride out cravings. Built to embed directly inside your existing AEM-backed React SPA with Tailwind v4. No characters, no theme—just a smooth, hypnotic “tap when the pulse meets the halo” loop with score chasing.
Quick Facts
Tech: React + TypeScript + Canvas 2D (no third-party game/UI libs)
UI: Tailwind v4 utilities (no global CSS)
Input: Entire component is the tap target (touch/mouse); Space/Enter for keyboard
Performance: requestAnimationFrame loop; React kept out of hot path
Persistence: LocalStorage (namespaced) for best score, settings, and lifetime stats
Accessibility: Reduced motion support, keyboard controls, high-contrast halo/ring
File Structure
Drop these under src/games/zen-pulse/:
src/
  games/
    zen-pulse/
      index.ts
      ZenPulse.tsx
      useZenPulse.ts
      engine.ts
      types.ts
      audio.ts
      store.ts
      README.md
Installation & Requirements
Your app already has React + Tailwind v4 configured.
No additional packages required.
If you keep Tailwind’s defaults, you’re good. If you use a highly customized config, ensure utilities like bg-white/10, backdrop-blur, and text-white/70 are available (or substitute equivalents).
Usage
1) Export
// src/games/zen-pulse/index.ts
export { default as ZenPulse } from './ZenPulse';
2) Lazy-load and mount from your Games page
// src/pages/Games.tsx
import React, { Suspense, useState } from 'react';
const ZenPulse = React.lazy(() =>
  import('../games/zen-pulse').then(m => ({ default: m.ZenPulse }))
);

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
Component API
type ZenPulseProps = {
  /** Optional title rendered in the top bar (default: "Zen Pulse") */
  title?: string;

  /** Called when user taps Exit in HUD (or presses Esc if enabled) */
  onExit?: () => void;

  /** Start with sound off/on (default: false = muted) */
  startMuted?: boolean;

  /** Force calm (reduced motion) regardless of media query (default: false) */
  forceCalmMode?: boolean;

  /** Optional Tailwind classes for outer wrapper */
  className?: string;
};
Mounting contract: The component fills its parent (w-full h-full) and assumes it can be placed in a fixed/fullscreen container for play. It cleans up all event listeners, rAF, and WebAudio on unmount.
Game Design (at a glance)
Goal: Tap to stop an expanding ring on a faint target halo.
Scoring windows (distance as % of the shorter canvas side):
Perfect ≤ 1.75% → +100
Great ≤ 4.0% → +70
Good ≤ 7.0% → +40
Miss > 7.0% → +0 (streak reset)
Streak & multiplier: multiplier = 1 + floor(streak / 10)
Focus Shield: Earned at 10-hit streak (max 1). Converts next Miss to Good and is consumed.
Focus Round: Occasionally slower growth, tighter Perfect (1.2%), Perfect = +150.
Session: 90s timer → results card (Score, Best, Accuracy %, Longest Streak, Plays) with Play Again and Exit.
Controls & Accessibility
Tap/Click anywhere within the component to “lock” the ring
Keyboard: Space/Enter = tap, P = pause/resume, R = restart
Reduced motion: Honors prefers-reduced-motion; in-game Calm Mode toggle overrides animation intensity and disables hue drift/particles
Contrast: Target halo and ring include outlines for visibility across palettes
Audio: Soft WebAudio tones (muted by default) with a HUD toggle; audio starts only after a user gesture
Styling Notes (Tailwind v4)
Layout: relative w-full h-full overflow-hidden touch-none
HUD: absolute inset-x-0 top-0 flex items-center justify-between p-3
Buttons: inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/15 active:bg-white/20
Badges: rounded-full bg-white/10 px-2 py-1 text-xs backdrop-blur
Use inline style={{ paddingTop: 'env(safe-area-inset-top)' }} where needed to respect iOS safe areas.
No global CSS is added. If a tiny custom rule is necessary (e.g., cursor styles), it’s injected via a scoped <style> tag on the component root.
Persistence (LocalStorage Keys)
All keys are namespaced to avoid collisions:
qz.zenpulse.best — best score (number)
qz.zenpulse.settings — JSON: { muted: boolean, calmMode: boolean, showTapHint: boolean }
qz.zenpulse.stats — JSON: { plays: number, perfectRate: number, longestStreak: number }
Architecture Overview
ZenPulse.tsx — Root component: canvas host, HUD, modals, keyboard bindings, lifecycle cleanup.
useZenPulse.ts — Reducer-based state machine:
states: 'ready' | 'playing' | 'paused' | 'gameover'
actions: start, tap, tick, pause, resume, restart, end
engine.ts — Canvas engine: initializes context, handles resize+DPR scaling, computes ring radius, target, scoring bands, hue drift, and lightweight particles; runs requestAnimationFrame loop with delta-time.
audio.ts — Minimal WebAudio helpers: tick, chime, thud; guarded by a master mute toggle and initialized only after a user gesture; closed on unmount.
store.ts — LocalStorage helpers (get/set/merge) with try/catch safety.
Performance: React renders only HUD and shells; all animation is Canvas-side with object reuse. rAF cancels when tab is hidden (auto-pause) and on unmount.
Development & Testing
Add the files under src/games/zen-pulse/.
Use the Games page snippet above to load it full-screen (e.g., in a fixed inset-0 container).
Test on:
iOS Safari (notch/Dynamic Island; safe-areas; audio unlock on gesture)
Android Chrome (touch, back button behavior if you wrap in a modal)
Desktop (mouse + keyboard)
Verify reduced-motion behavior (System setting + in-app toggle).
Debug flags (optional if implemented):
?calm=1 — force calm mode
?seed=1234 — deterministic RNG
?speed=750 — base px/sec override
Troubleshooting
Canvas looks blurry on mobile: Ensure DPR scaling is applied in engine.ts and the canvas size updates on resize/orientation changes.
Audio doesn’t play: WebAudio must start after a user gesture and is muted by default. Toggle sound after tapping once.
Laggy on low-end devices: Calm mode reduces effects; cap speed and particle count; confirm nothing in React re-renders every frame.
Layout clipped under the iOS notch: Wrap HUD with safe-area padding using env(safe-area-inset-*) inline styles.
Acceptance Checklist
 Embeds into any container; no global styles or router changes
 Entire component is a tap target; keyboard controls work
 rAF, listeners, AudioContext fully cleaned up on unmount
 Scoring windows, multiplier, Focus Shield, Focus Rounds behave as specified
 Muted by default; settings and best score persist (namespaced keys)
 Respects reduced motion (and Calm Mode toggle)
 Results card shows Score, Best, Accuracy %, Longest Streak, Plays
 No external dependencies beyond React
License
Copyright © you/your-org. Include your preferred license here.
Attribution
Concept and spec authored for a mindfulness-aligned craving-interruption mini-game within a PWA “Games” section.
