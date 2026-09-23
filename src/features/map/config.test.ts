import { describe, expect, it } from "vitest";
import {
  DEFAULT_TILE_PROVIDER,
  DEFAULT_VIEWPORT,
  LAGOS_CENTER,
  createClearRoadStyle,
} from "./config";

/**
 * M1 provider contract (keyless VECTOR night, honest).
 *
 *  - **Keyless + honest**: the seam default is OpenFreeMap's keyless **vector**
 *    `dark` night style — no registration, no API key, no cookies. It is NOT a
 *    production SLA (stated in code + docs and enforced here). Swap
 *    {@link DEFAULT_TILE_PROVIDER} for a self-hosted / sponsored instance one
 *    place before heavy traffic.
 *  - **Why not CARTO Dark Matter (the earlier M1 raster)?** CARTO now serves
 *    keyless raster requests with a literal **`API KEY REQUIRED` watermark**
 *    and is retiring the raster basemaps in favour of vector. OpenFreeMap is
 *    the documented, legitimate, keyless path: OSM data via OpenMapTiles,
 *    MIT/open-source styles, no registration/key/cookies, attribution REQUIRED
 *    and NEVER stripped. Vector also fixes the M1 sharpness problem — the
 *    browser renders STYLED vector tiles, so roads, labels and coastline stay
 *    crisp at ANY device ratio; there is no `{r}`/`@2x` raster token to get
 *    wrong. See docs/ARCHITECTURE.
 */

describe("Lagos default viewport (night readability)", () => {
  it("is centred on Lagos centre", () => {
    expect(DEFAULT_VIEWPORT.center).toEqual([LAGOS_CENTER.lng, LAGOS_CENTER.lat]);
  });

  it("sits in the readable Lagos band, night-zoom, never a blank jump", () => {
    expect(DEFAULT_VIEWPORT.minZoom).toBeLessThanOrEqual(DEFAULT_VIEWPORT.zoom);
    expect(DEFAULT_VIEWPORT.zoom).toBeLessThanOrEqual(DEFAULT_VIEWPORT.maxZoom);
    expect(DEFAULT_VIEWPORT.zoom).toBeGreaterThanOrEqual(9.5);
    expect(DEFAULT_VIEWPORT.maxZoom).toBeLessThanOrEqual(19);
  });
});

describe("default tile provider (keyless, honest, vector, attributed)", () => {
  it("is the keyless OpenFreeMap `dark` VECTOR night style (no CARTO raster)", () => {
    expect(DEFAULT_TILE_PROVIDER.styleUrl).toMatch(/^https:\/\//);
    expect(DEFAULT_TILE_PROVIDER.styleUrl).toMatch(/tiles\.openfreemap\.org\/styles\/dark/);
    expect(DEFAULT_TILE_PROVIDER.styleUrl).not.toContain("cartocdn.com");
  });

  it("has NO API key, NO `{r}`/`@2x` raster sharpness tokens on the wire", () => {
    expect(DEFAULT_TILE_PROVIDER.styleUrl).not.toMatch(/[?&](api_key|key|token)=/i);
    expect(DEFAULT_TILE_PROVIDER.styleUrl).not.toContain("{r}");
    expect(DEFAULT_TILE_PROVIDER.styleUrl).not.toContain("@2x");
  });

  it("carries attribution that is REQUIRED and NEVER stripped (attribution is not optional)", () => {
    expect(DEFAULT_TILE_PROVIDER.attribution.length).toBeGreaterThan(0);
    expect(DEFAULT_TILE_PROVIDER.attribution).toMatch(/openfreemap/i);
    expect(DEFAULT_TILE_PROVIDER.attribution).toMatch(/openstreetmap/i);
  });

  it("is honest about licence + production path + costs (no overclaim)", () => {
    const s = JSON.stringify(DEFAULT_TILE_PROVIDER).toLowerCase();
    expect(s).toContain("keyless");
    expect(s).toContain("self-host");
    expect(s).toContain("attribution");
  });
});

describe("createClearRoadStyle (pure, keyless, vector night seam)", () => {
  it("is a valid MapLibre vector style named for the Lagos night map", () => {
    const style = createClearRoadStyle();
    expect(style.version).toBe(8);
    expect(style.name).toMatch(/clear road/i);
    expect(typeof style).toBe("object");
  });
});
