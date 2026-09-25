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
import { createSightingMarkerElement } from "../sightings/markers";
import { visibleRadiusKm, type PublicSighting } from "../sightings/sightings";
import "maplibre-gl/dist/maplibre-gl.css";
import { applyBasemap, SATELLITE_SOURCE, type BasemapMode } from "./basemap";
import { nearbyArea } from "./area-name";
import type { LocatePosition } from "./locate";

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
  basemap: BasemapMode;
  satelliteKey: string;
  onBasemapChange: (mode: BasemapMode) => void;
  locatePosition: LocatePosition | null;
  onAreaChange: (name: string) => void;
  onLocationLabel: (value: { lat: number; lng: number; label: string }) => void;
  sightings: readonly PublicSighting[];
  selectedSightingId: string | null;
  onSelectSighting: (id: string) => void;
  onViewportChange: (viewport: { lat: number; lng: number; radiusKm: number }) => void;
  reportPlacementMode: boolean;
  reportLocation: { lat: number; lng: number } | null;
  onReportLocationChange: (location: { lat: number; lng: number }) => void;
}

export function MapView({
  accent,
  basemap,
  satelliteKey,
  onBasemapChange,
  locatePosition,
  onAreaChange,
  onLocationLabel,
  sightings,
  selectedSightingId,
  onSelectSighting,
  onViewportChange,
  reportPlacementMode,
  reportLocation,
  onReportLocationChange,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRefs = useRef(new Map<string, maplibregl.Marker>());
  const reportMarkerRef = useRef<maplibregl.Marker | null>(null);
  const areaChangeRef = useRef(onAreaChange);
  const selectSightingRef = useRef(onSelectSighting);
  const viewportChangeRef = useRef(onViewportChange);
  const reportLocationChangeRef = useRef(onReportLocationChange);
  const reportPlacementRef = useRef(reportPlacementMode);
  const [satelliteError, setSatelliteError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [bootFailed, setBootFailed] = useState(false);
  const [basemapDegraded, setBasemapDegraded] = useState(false);

  useEffect(() => {
    areaChangeRef.current = onAreaChange;
    selectSightingRef.current = onSelectSighting;
    viewportChangeRef.current = onViewportChange;
    reportLocationChangeRef.current = onReportLocationChange;
    reportPlacementRef.current = reportPlacementMode;
  }, [
    onAreaChange,
    onSelectSighting,
    onViewportChange,
    onReportLocationChange,
    reportPlacementMode,
  ]);

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
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    const publishArea = () => {
      if (!map.isStyleLoaded()) return;
      const center = map.getCenter();
      const places = map.querySourceFeatures(NIGHT_SOURCE_ID, { sourceLayer: "place" });
      let closest = Infinity;
      let name = "MAP AREA";
      for (const place of places) {
        if (place.geometry.type !== "Point") continue;
        const properties = place.properties;
        if (!["city", "town", "village", "suburb", "neighbourhood"].includes(properties.class))
          continue;
        const label = properties.name_en || properties.name;
        if (typeof label !== "string" || !label.trim()) continue;
        const [lng, lat] = place.geometry.coordinates;
        const distance = center.distanceTo(new maplibregl.LngLat(lng, lat));
        if (distance < closest && distance < 30000) {
          closest = distance;
          name = label.toUpperCase();
        }
      }
      areaChangeRef.current(name);
    };
    map.on("idle", publishArea);
    const publishViewport = () => {
      areaChangeRef.current("MAP AREA");
      const center = map.getCenter();
      const bounds = map.getBounds();
      viewportChangeRef.current({
        lat: center.lat,
        lng: center.lng,
        radiusKm: visibleRadiusKm(
          bounds.getNorth() - bounds.getSouth(),
          bounds.getEast() - bounds.getWest(),
        ),
      });
    };

    map.on("error", (event) => {
      if (disposed) return;
      const detail = event as unknown as {
        sourceId?: string;
        tile?: unknown;
      };
      if (detail.sourceId === SATELLITE_SOURCE) return;
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
      publishViewport();
    });
    map.on("moveend", publishViewport);
    map.on("click", (event) => {
      if (reportPlacementRef.current) {
        reportLocationChangeRef.current({ lat: event.lngLat.lat, lng: event.lngLat.lng });
      }
    });

    return () => {
      disposed = true;
      map.remove();
      mapRef.current = null;
    };
  }, [retryKey, accent]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const nextIds = new Set(sightings.map((sighting) => sighting.id));
    for (const [id, marker] of markerRefs.current) {
      if (!nextIds.has(id)) {
        marker.remove();
        markerRefs.current.delete(id);
      }
    }
    for (const sighting of sightings) {
      let marker = markerRefs.current.get(sighting.id);
      if (!marker) {
        marker = new maplibregl.Marker({
          element: createSightingMarkerElement(sighting, (id) => selectSightingRef.current(id)),
          anchor: "center",
        });
        markerRefs.current.set(sighting.id, marker);
        marker.setLngLat([sighting.location.lng, sighting.location.lat]).addTo(map);
      }
      marker.setLngLat([sighting.location.lng, sighting.location.lat]);
      marker
        .getElement()
        .classList.toggle("sighting-marker--active", selectedSightingId === sighting.id);
      marker.getElement().setAttribute("aria-pressed", String(selectedSightingId === sighting.id));
    }
  }, [sightings, selectedSightingId, retryKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    reportMarkerRef.current?.remove();
    reportMarkerRef.current = null;
    if (!reportLocation) return;
    const element = document.createElement("div");
    element.className = "report-location-marker";
    element.setAttribute("aria-label", "Report location");
    element.title = "REPORT LOCATION";
    reportMarkerRef.current = new maplibregl.Marker({ element, anchor: "center" })
      .setLngLat([reportLocation.lng, reportLocation.lat])
      .addTo(map);
  }, [reportLocation, retryKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !locatePosition) return;
    const center: [number, number] = [locatePosition.longitude, locatePosition.latitude];
    const shell = map.getContainer().closest(".map-shell");
    const header = shell?.querySelector(".device-header")?.getBoundingClientRect();
    const controls = shell?.querySelector(".map-locate-control")?.getBoundingClientRect();
    const bounds = map.getContainer().getBoundingClientRect();
    const top = header ? header.bottom - bounds.top : 0;
    const bottom = window.innerWidth < 768 && controls ? controls.top - bounds.top : bounds.height;
    const offset = (top + Math.max(top, bottom)) / 2 - bounds.height / 2;
    map.jumpTo({ center, zoom: Math.max(map.getZoom(), 14) });
    map.panBy([0, -offset], { duration: 0 });
    const element = document.createElement("div");
    element.className = "user-location-marker";
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", "Your location");
    const marker = new maplibregl.Marker({ element }).setLngLat(center).addTo(map);
    return () => {
      marker.remove();
    };
  }, [locatePosition, retryKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => applyBasemap(map, basemap, satelliteKey);
    const fail = (event: maplibregl.ErrorEvent) => {
      if (
        (event as maplibregl.ErrorEvent & { sourceId?: string }).sourceId !== SATELLITE_SOURCE ||
        basemap !== "satellite"
      )
        return;
      applyBasemap(map, "map", satelliteKey);
      if (map.getLayer(SATELLITE_SOURCE)) map.removeLayer(SATELLITE_SOURCE);
      if (map.getSource(SATELLITE_SOURCE)) map.removeSource(SATELLITE_SOURCE);
      onBasemapChange("map");
      setSatelliteError(true);
    };
    const loaded = (event: maplibregl.MapSourceDataEvent) => {
      if (event.sourceId === SATELLITE_SOURCE && event.isSourceLoaded) setSatelliteError(false);
    };
    map.on("load", apply);
    map.on("error", fail);
    map.on("sourcedata", loaded);
    if (map.getLayer("highway_major_casing")) apply();
    return () => {
      map.off("load", apply);
      map.off("error", fail);
      map.off("sourcedata", loaded);
    };
  }, [basemap, satelliteKey, onBasemapChange, retryKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const attribution = map.getContainer().querySelector(".maplibregl-ctrl-attrib");
    const shell = map.getContainer().closest<HTMLElement>(".map-shell");
    const surface = map.getContainer().parentElement;
    if (!attribution || !shell || !surface) return;
    const measure = () => {
      const height = Math.max(32, attribution.getBoundingClientRect().height + 12) + "px";
      shell.style.setProperty("--map-attribution-height", height);
      surface.style.setProperty("--map-attribution-height", height);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(attribution);
    measure();
    return () => {
      observer.disconnect();
      shell.style.removeProperty("--map-attribution-height");
      surface.style.removeProperty("--map-attribution-height");
    };
  }, [retryKey]);

  const selected = sightings.find((sighting) => sighting.id === selectedSightingId);
  const selectedLat = selected?.location.lat;
  const selectedLng = selected?.location.lng;

  const namedLat = reportLocation?.lat ?? selectedLat;
  const namedLng = reportLocation?.lng ?? selectedLng;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || namedLat === undefined || namedLng === undefined) return;
    const resolve = () => {
      if (!map.getSource(NIGHT_SOURCE_ID)) return;
      const places = map
        .querySourceFeatures(NIGHT_SOURCE_ID, { sourceLayer: "place" })
        .flatMap((feature) => {
          if (
            feature.geometry.type !== "Point" ||
            !["city", "town", "village", "suburb", "neighbourhood"].includes(
              feature.properties.class,
            )
          )
            return [];
          const name = feature.properties.name_en || feature.properties.name;
          if (typeof name !== "string") return [];
          return [
            { name, lng: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1] },
          ];
        });
      onLocationLabel({
        lat: namedLat,
        lng: namedLng,
        label: nearbyArea({ lat: namedLat, lng: namedLng }, places),
      });
    };
    resolve();
    map.on("idle", resolve);
    return () => {
      map.off("idle", resolve);
    };
  }, [namedLat, namedLng, onLocationLabel, retryKey]);

  // Keep the selected signal in the exposed map when the detail panel opens.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedLat === undefined || selectedLng === undefined) return;
    const container = map.getContainer();
    const shell = container.closest(".map-shell");
    const sheet = shell?.querySelector(".terminal-sheet");
    const header = shell?.querySelector(".device-header");
    if (!sheet || !header) return;
    const reveal = () => {
      const bounds = container.getBoundingClientRect();
      const panel = sheet.getBoundingClientRect();
      const top = header.getBoundingClientRect().bottom - bounds.top + 24;
      const controlTop =
        shell?.querySelector(".map-locate-control")?.getBoundingClientRect().top ?? panel.top;
      const bottom =
        window.innerWidth < 768
          ? Math.min(panel.top, controlTop) - bounds.top - 28
          : bounds.height - 24;
      if (bottom <= top) return;
      const point = map.project([selectedLng, selectedLat]);
      const targetY = (top + bottom) / 2;
      const targetX = bounds.width / 2;
      if (Math.abs(point.x - targetX) > 1 || Math.abs(point.y - targetY) > 1) {
        map.panBy([point.x - targetX, point.y - targetY], { duration: 0 });
      }
    };
    let frame = 0;
    const scheduleReveal = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(reveal);
    };
    const observer = new ResizeObserver(scheduleReveal);
    observer.observe(sheet);
    observer.observe(container);
    scheduleReveal();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [selectedLat, selectedLng, selectedSightingId, retryKey]);

  return (
    <div className="map-view-surface relative h-full w-full overflow-hidden bg-night-950">
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
      {basemap === "satellite" && (
        <a
          className="satellite-credit"
          href="https://www.maptiler.com"
          target="_blank"
          rel="noreferrer"
        >
          {/* Provider-required logo; direct asset avoids image proxying. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://api.maptiler.com/resources/logo.svg"
            alt="MapTiler"
            width="88"
            height="24"
          />
          <span>IMAGERY · NOT LIVE</span>
        </a>
      )}
      {satelliteError && (
        <div className="satellite-error" role="status">
          Satellite unavailable. Map view restored.
          <button
            type="button"
            onClick={() => setSatelliteError(false)}
            aria-label="Dismiss satellite message"
          >
            ×
          </button>
        </div>
      )}
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
        <div className="map-basemap-alert absolute left-1/2 top-[max(2.75rem,calc(env(safe-area-inset-top)+2.75rem))] z-20 -translate-x-1/2">
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
