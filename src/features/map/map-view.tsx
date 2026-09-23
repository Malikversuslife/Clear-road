"use client";

import * as maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import {
  createClearRoadStyle,
  DEFAULT_TILE_PROVIDER,
  DEFAULT_VIEWPORT,
  NIGHT_SOURCE_ID,
  NIGHT_TITLE,
} from "./config";
import "maplibre-gl/dist/maplibre-gl.css";

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

/** Single-source night title imported from the config seam (map keeps no copy). */

/**
 * The live Clear Road Lagos NIGHT map (client-only, keyless).
 *
 * **M1 vector seam (the one place, the whole point):** MapLibre is handed
 * {@link createClearRoadStyle} defaulting to the keyless **VECTOR** OpenFreeMap
 * night style via `style: createClearRoadStyle()` - a COMPLETE keyless Vector
 * style document. MapLibre fetches the keyless vector style + sources + glyphs
 * + sprites and renders styled night roads, labels and coastline at ANY device
 * ratio (vector crispness has no `{r}`/`@2x` raster token to get wrong). No
 * CARTO, no `cartocdn`, no `{r}` seam, no `API KEY REQUIRED` watermark on the
 * wire. Honest, keyless, vector.
 *
 * **Attribution contract (provider-REQUIRED, project-rule, NEVER optional):**
 * `attributionControl: { compact: false }` = the FULL expanded, non-compact
 * attribution row, docked at the container's bottom edge and rendered ~48px
 * OFF that edge (measured via CDP). The shell reserves `bottom-12` INSIDE the
 * viewport so the full non-compact attribution row is ALWAYS visible - never
 * stripped, never obscured, never clipped past the fold, NEVER stripped.
 *
 * **Failure contract:** boot failure (WebGL/tiles) shows a branded panel with
 * retry; basemap tile hiccups show a branded strip with retry. The map is
 * never a dead-silent blank pixel - the driver gets an honest signal and a
 * way forward, always.
 */
export interface MapViewProps {
  /** Brand accent Tailwind color token for the retry chip. */
  accent: string;
}

export function MapView({ accent }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [bootFailed, setBootFailed] = useState(false);
  const [basemapDegraded, setBasemapDegraded] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    // M1 vector seam, in ONE place: keyless VECTOR vector night style document.
    const map = new maplibregl.Map({
      container,
      style: createClearRoadStyle(DEFAULT_TILE_PROVIDER),
      center: DEFAULT_VIEWPORT.center,
      zoom: DEFAULT_VIEWPORT.zoom,
      minZoom: DEFAULT_VIEWPORT.minZoom,
      maxZoom: DEFAULT_VIEWPORT.maxZoom,
      // attributionControl: { compact: false } = the FULL expanded non-compact
      // attribution row, required by the provider and NEVER stripped. The
      // shell reserves bottom-12 INSIDE the viewport so this full attribution
      // row is ALWAYS visible - never stripped, never clipped past the fold.
      attributionControl: { compact: false },
    });
    mapRef.current = map;

    map.on("error", (event) => {
      if (disposed) return;
      const detail = event as unknown as {
        sourceId?: string;
        tile?: unknown;
      };
      if (detail.sourceId === NIGHT_SOURCE_ID || detail.tile) {
        setBasemapDegraded(true);
        return;
      }
      setBootFailed(true);
    });
    map.on("sourcedata", (event) => {
      if (disposed) return;
      const detail = event as unknown as {
        sourceId?: string;
        isSourceLoaded?: boolean;
      };
      if (detail.sourceId === NIGHT_SOURCE_ID && detail.isSourceLoaded) {
        setBasemapDegraded(false);
      }
    });
    map.on("load", () => {
      if (disposed) return;
      setBootFailed(false);
    });

    return () => {
      disposed = true;
      map.remove();
      mapRef.current = null;
    };
  }, [retryKey, accent]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-night-950">
      {/* MapLibre docks the attribution row at the container's bottom edge but
          renders it ~48px OFF that edge (measured via CDP). bottom-12 reserves
          that band INSIDE the viewport so the full non-compact attribution
          row is ALWAYS visible - never stripped, never clipped past the fold. */}
      <div
        ref={containerRef}
        className="absolute inset-x-0 top-0 bottom-12"
        style={{ position: "absolute", inset: "0 0 3rem" }}
        role="application"
        aria-label={NIGHT_TITLE}
        title={NIGHT_TITLE}
      />
      {bootFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-night-950 p-6">
          <div className="max-w-sm rounded-md border-2 border-night-600 bg-surface p-6 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-coral">
              map unavailable
            </p>
            <p className="mt-3 text-sm text-ink">
              The night map could not start (WebGL or tiles). Clear Road keeps working - choose a
              retry and drive on.
            </p>
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="mt-5 border-2 border-ink bg-lime px-4 py-2 font-mono text-xs uppercase tracking-widest text-ink"
            >
              retry
            </button>
          </div>
        </div>
      )}
      {!bootFailed && basemapDegraded && (
        <div className="absolute left-1/2 top-[max(2.75rem,calc(env(safe-area-inset-top)+2.75rem))] z-20 -translate-x-1/2">
          <div className="flex items-center gap-3 border border-coral/60 bg-night-950/85 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-cream backdrop-blur-sm">
            <span className="animate-pulse text-coral">basemap hiccuped</span>
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="border border-cream/40 px-2 py-1 text-cream hover:border-cream"
            >
              retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
