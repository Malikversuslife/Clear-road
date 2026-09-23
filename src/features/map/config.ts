import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";

/** Accessible night map title — SINGLE source (the seam builds names from it). */
export const NIGHT_TITLE = "Clear Road - Lagos NIGHT (keyless vector)";

/**
 * Clear Road map configuration (M1 seam — keyless VECTOR night).
 *
 *  - **Pure**: no DOM, no MapLibre runtime, no side effects — unit-testable in
 *    Node, SSR-safe, and honest about what it is.
 *  - **Honest + keyless**: the dev default is OpenFreeMap's keyless **vector**
 *    `dark` night style (no registration, no API key, no cookies). It is NOT a
 *    production SLA — stated in code + docs and enforced by the provider
 *    tests; swap {@link DEFAULT_TILE_PROVIDER} for a self-hosted / sponsored
 *    instance before heavy traffic (ONE place).
 *
 * Why not CARTO Dark Matter (M1's earlier raster)? CARTO now serves keyless
 * raster requests with a literal **`API KEY REQUIRED` watermark** and is
 * retiring the raster basemaps in favour of vector. OpenFreeMap is the
 * documented, legitimate, keyless path — OSM data via OpenMapTiles,
 * MIT/open-source styles, no registration/key/cookies, and an attribution
 * that is REQUIRED by the project and NEVER stripped. Vector is also how we
 * fix the M1 sharpness problem: roads, labels and coastline are rendered by
 * the browser from STYLED VECTOR tiles at ANY device ratio — there is no
 * `{r}`/`@2x` raster token to get wrong (documented in docs/ARCHITECTURE).
 */

/** Lagos, Nigeria (lat/lng) — first-class city. */
export const LAGOS_CENTER = { lat: 6.5244, lng: 3.3792 } as const;

/** Default session viewport: Lagos, city-wide, readable, night-friendly. */
export const DEFAULT_VIEWPORT = {
  center: [LAGOS_CENTER.lng, LAGOS_CENTER.lat] as [number, number],
  zoom: 12.5,
  minZoom: 9.5,
  maxZoom: 19,
} as const;

/** Geolocation give-up / accuracy-accept threshold (responsive, not rigid). */
export const LOCATE_TIMEOUT_MS = 10_000 as const;

/** True when an absolute keyless `https` URL of a MapLibre vector style. */
export interface TileProvider {
  id: string;
  name: string;
  /** Absolute keyless `https` URL of a MapLibre vector style document. */
  styleUrl: string;
  /** Required attribution — rendered, NEVER stripped or obscured. */
  attribution: string;
  /** Honest licence + production cost/path note — never an overclaim. */
  licenseAndCosts: string;
}

export const DEFAULT_TILE_PROVIDER: TileProvider = {
  id: "clear-road-openfreemap-dark",
  name: "OpenFreeMap dark (keyless vector)",
  styleUrl: "https://tiles.openfreemap.org/styles/dark",
  attribution: "© OpenFreeMap © OpenMapTiles, Data from OpenStreetMap contributors",
  licenseAndCosts:
    "keyless dev/fair-use public instance (no API key, no registration, no " +
    "cookies); production: self-host open-source server or sponsor public " +
    "instance; no per-request tile fee either way; attribution ALWAYS " +
    "required.",
};

/** MapLibre source id for the night vector (stable handle for tile-error + tests). */
export const NIGHT_SOURCE_ID = "clear-road-night" as const;

/** MapLibre layer id for the night vector layer. */
export const NIGHT_LAYER_ID = `${NIGHT_SOURCE_ID}-vector` as const;

/**
 * Build the full MapLibre style document for Clear Road (pure, vector).
 *
 *  - One keyless vector source + one night vector layer bound to the
 *    provider's keyless vector style URL; MapLibre fetches the remote style,
 *    renders styled roads/labels/coastline at ANY device ratio, and always
 *    docks the REQUIRED attribution (never stripped, never obscured).
 *  - Pure + SSR-safe: returns a serialisable document with no DOM.
 */
export function createClearRoadStyle(
  provider: TileProvider = DEFAULT_TILE_PROVIDER,
): StyleSpecification {
  return {
    version: 8,
    name: `${NIGHT_TITLE} (${provider.id})`,
    // Keyless VECTOR night: the browser renders STYLED vector tiles, so
    // roads, labels and coastline stay crisp at ANY device ratio - there is
    // no `{r}`/`@2x` raster token anywhere on the wire. Keyless OpenFreeMap
    // keyless vector endpoints (glyphs + sprite + planet vector source).
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sprite: "https://tiles.openfreemap.org/sprites/ofm_f384/ofm",
    sources: {
      [NIGHT_SOURCE_ID]: {
        type: "vector",
        // keyless VECTOR planet tileset - one keyless vector source, keyless
        // style document seam, attribution REQUIRED and NEVER stripped.
        url: "https://tiles.openfreemap.org/planet",
        attribution: provider.attribution,
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "rgb(12,12,12)" } },
      {
        id: "water",
        type: "fill",
        source: NIGHT_SOURCE_ID,
        "source-layer": "water",
        paint: { "fill-color": "rgb(27,27,29)" },
      },
      {
        id: "landuse_residential",
        type: "fill",
        source: NIGHT_SOURCE_ID,
        "source-layer": "landuse",
        filter: ["all", ["==", ["get", "class"], "residential"]],
        paint: { "fill-color": "hsl(0,2%,5%)", "fill-opacity": 0.4 },
      },
      {
        id: "highway_major_casing",
        type: "line",
        source: NIGHT_SOURCE_ID,
        "source-layer": "transportation",
        filter: [
          "all",
          ["match", ["get", "class"], ["primary", "secondary", "tertiary", "trunk"], true, false],
        ],
        paint: {
          "line-color": "rgba(78,78,78,0.72)",
          "line-width": ["interpolate", ["exponential", 1.3], ["zoom"], 10, 2, 16, 4, 19, 9],
        },
      },
      {
        id: "highway_major_inner",
        type: "line",
        source: NIGHT_SOURCE_ID,
        "source-layer": "transportation",
        minzoom: 10,
        filter: [
          "all",
          ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
          ["match", ["get", "class"], ["primary", "secondary", "tertiary", "trunk"], true, false],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "rgb(38,38,38)",
          "line-width": ["interpolate", ["exponential", 1.3], ["zoom"], 10, 1, 16, 2, 19, 6],
        },
      },
      {
        id: "highway_minor",
        type: "line",
        source: NIGHT_SOURCE_ID,
        "source-layer": "transportation",
        minzoom: 10,
        filter: [
          "all",
          ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
          ["match", ["get", "class"], ["minor", "service", "track"], true, false],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "rgba(42,42,42,0.86)",
          "line-width": ["interpolate", ["exponential", 1.55], ["zoom"], 10, 1, 14, 2, 18, 8],
        },
      },
      {
        id: "water_name",
        type: "symbol",
        source: NIGHT_SOURCE_ID,
        "source-layer": "water_name",
        filter: ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 500,
          "text-field": ["coalesce", ["get", "name_en"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
        },
        paint: {
          "text-color": "rgba(112,112,112,0.8)",
          "text-halo-color": "rgb(12,12,12)",
          "text-halo-width": 1,
        },
      },
      {
        id: "highway_name_other",
        type: "symbol",
        source: NIGHT_SOURCE_ID,
        "source-layer": "transportation_name",
        minzoom: 12,
        filter: [
          "all",
          ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
          ["!=", ["get", "class"], "motorway"],
        ],
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 350,
          "text-field": ["coalesce", ["get", "name_en"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-max-angle": 30,
          "text-size": 10,
          "text-transform": "uppercase",
        },
        paint: {
          "text-color": "rgba(156,156,156,0.9)",
          "text-halo-color": "rgb(8,8,8)",
          "text-halo-width": 1,
        },
      },
      {
        id: "place_city_large",
        type: "symbol",
        source: NIGHT_SOURCE_ID,
        "source-layer": "place",
        minzoom: 9,
        maxzoom: 14,
        filter: [
          "all",
          ["match", ["geometry-type"], ["MultiPoint", "Point"], true, false],
          ["==", ["get", "class"], "city"],
          ["<=", ["get", "rank"], 3],
        ],
        layout: {
          "text-anchor": "center",
          "text-field": ["coalesce", ["get", "name_en"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": 14,
          "text-transform": "uppercase",
        },
        paint: {
          "text-color": "rgba(190,190,190,0.95)",
          "text-halo-color": "rgb(8,8,8)",
          "text-halo-width": 1.5,
        },
      },
      {
        id: "place_suburb",
        type: "symbol",
        source: NIGHT_SOURCE_ID,
        "source-layer": "place",
        minzoom: 11,
        maxzoom: 16,
        filter: [
          "all",
          ["match", ["geometry-type"], ["MultiPoint", "Point"], true, false],
          ["==", ["get", "class"], "suburb"],
        ],
        layout: {
          "text-anchor": "center",
          "text-field": ["coalesce", ["get", "name_en"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": 10,
          "text-transform": "uppercase",
        },
        paint: {
          "text-color": "rgba(118,118,118,0.9)",
          "text-halo-color": "rgb(8,8,8)",
          "text-halo-width": 1,
        },
      },
    ],
    // The seam's ONE honest control point: attribution metadata that MapLibre's
    // attributionControl (compact:false) renders in the FULL expanded row.
    metadata: {
      "clear-road:providerId": provider.id,
      "clear-road:styleUrl": provider.styleUrl,
      "clear-road:keyless": true,
    },
  } satisfies StyleSpecification;
}
