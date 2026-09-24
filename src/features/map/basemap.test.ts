import { describe, expect, it, vi } from "vitest";
import type { Map } from "maplibre-gl";
import { applyBasemap, satelliteSource, SATELLITE_SOURCE } from "./basemap";
function fakeMap() {
  const sources = new Set<string>();
  const layers = new Set<string>();
  return {
    getSource: (id: string) => sources.has(id),
    getLayer: (id: string) => layers.has(id),
    addSource: vi.fn((id: string) => sources.add(id)),
    addLayer: vi.fn((layer: { id: string }) => layers.add(layer.id)),
    setLayoutProperty: vi.fn(),
  };
}
describe("satellite mode", () => {
  it("makes no imagery source without a key or before selection", () => {
    const map = fakeMap();
    applyBasemap(map as unknown as Map, "map", "test");
    applyBasemap(map as unknown as Map, "satellite", "");
    expect(map.addSource).not.toHaveBeenCalled();
  });
  it("reuses the layer across switches without replacing the map", () => {
    const map = fakeMap();
    for (const mode of ["satellite", "map", "satellite"] as const)
      applyBasemap(map as unknown as Map, mode, "test");
    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    expect(map.addLayer.mock.calls[0][0].id).toBe(SATELLITE_SOURCE);
    expect(map.setLayoutProperty.mock.calls.map((call) => call[2])).toEqual([
      "visible",
      "none",
      "visible",
    ]);
  });
  it("uses TileJSON so provider credits and coverage metadata are retained", () => {
    expect(satelliteSource(" a&b ").url).toBe(
      "https://api.maptiler.com/tiles/satellite/tiles.json?key=a%26b",
    );
  });
});
