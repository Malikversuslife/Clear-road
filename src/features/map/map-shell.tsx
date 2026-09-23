"use client";

import dynamic from "next/dynamic";
import { useGeolocation } from "./use-geolocation";

const MapView = dynamic(() => import("./map-view").then((m) => m.MapView), {
  ssr: false,
});

/**
 * SSR-safe host for the Clear Road Lagos night map.
 *
 * Privacy contract (locked in code + tests):
 *  - Locate fires ONLY from the explicit locate button press below - nothing
 *    on mount/load/focus/visibilitychange, no auto-request.
 *  - The fix and its status live in reducer/React memory only - no
 *    localStorage / sessionStorage / cookies, no Supabase write, no
 *    continuous watching. One discrete getCurrentPosition.
 *  - On denied/unavailable the map keeps working and the chip tells the truth -
 *    the map is never the hostage of a permission screen.
 */
export interface MapShellProps {
  /** Brand accent hue (Tailwind color token name) for the locate chip. */
  accent: string;
}

export function MapShell({ accent }: MapShellProps) {
  const { state, request } = useGeolocation();

  const label =
    state.phase === "idle"
      ? "locate me"
      : state.phase === "requesting"
        ? "fixing..."
        : state.phase === "available"
          ? "fix acquired"
          : state.phase === "denied"
            ? "location denied"
            : "location unavailable";

  return (
    <div
      className="relative min-h-0 w-full overflow-hidden bg-night-950"
      style={{ flex: "1 1 0%", minHeight: 0 }}
    >
      <MapView accent={accent} />
      {/* Brand overlay - lives OUTSIDE the MapLibre container and above it in
          stacking, so it stays visible even if the basemap/provider fails. */}
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 flex items-start justify-between gap-3 pt-[max(0px,env(safe-area-inset-top))]">
        <div className="pointer-events-auto">
          <p className="font-mono text-[13px] font-bold uppercase tracking-[0.42em] text-cream drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            Clear Road
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-lime/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            see what&apos;s ahead.
          </p>
        </div>
        <div className="pointer-events-auto flex items-center gap-2 border border-lime/40 bg-night-950/80 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-cream/90 backdrop-blur-sm">
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-lime"
          />
          Road clear?
        </div>
      </div>
      {/* Bottom-right control cluster - sits ABOVE the attribution dock band
          (48px below the map container) so the two never collide. */}
      <div className="absolute bottom-[max(6.5rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-20 flex flex-col items-end gap-3">
        <button
          type="button"
          onClick={request}
          disabled={state.phase === "requesting"}
          className="flex items-center gap-2 border-2 border-lime bg-lime px-4 py-2 font-mono text-xs uppercase tracking-[0.3em] text-night-950 shadow-[0_0_18px_rgba(190,242,100,0.35)] transition hover:border-cream disabled:cursor-wait disabled:opacity-60"
        >
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-night-950" />
          {label}
        </button>

        {state.phase === "available" && state.position && (
          <div
            role="status"
            className="max-w-xs border-2 border-lime bg-night-950/95 px-3 py-2 font-mono text-[11px] leading-relaxed text-lime"
          >
            <span className="uppercase tracking-[0.3em]">fix acquired</span>
            <div className="mt-1 break-all text-cream/80">
              {state.position.latitude.toFixed(5)}, {state.position.longitude.toFixed(5)}
            </div>
            <div className="mt-0.5 text-cream/50">
              accuracy approx. {(state.position.accuracy ?? 0).toFixed(0)} m
            </div>
          </div>
        )}

        {(state.phase === "denied" || state.phase === "unavailable") && (
          <div
            role="alert"
            className="max-w-xs border-2 border-coral bg-night-950/95 px-3 py-2 font-mono text-[11px] leading-relaxed text-cream"
          >
            <span className="uppercase tracking-[0.3em] text-coral">
              {state.phase === "denied" ? "location denied" : "location unavailable"}
            </span>
            <p className="mt-1 text-cream/70">
              The map is fully live. The fix was refused or is impossible in this browser. Nothing
              was stored.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
