import type { Map, RasterSourceSpecification } from "maplibre-gl";
export type BasemapMode = "map" | "satellite";
export const SATELLITE_SOURCE = "clear-road-satellite";
export function satelliteSource(key: string): RasterSourceSpecification {
  return {
    type: "raster",
    url:
      "https://api.maptiler.com/tiles/satellite/tiles.json?key=" +
      encodeURIComponent(key.trim()),
    tileSize: 256,
  };
}
/** Change only the imagery layer; camera, vector labels and DOM markers stay intact. */
export function applyBasemap(map: Map, mode: BasemapMode, key: string): void {
  if (mode === "satellite" && key.trim()) {
    if (!map.getSource(SATELLITE_SOURCE)) map.addSource(SATELLITE_SOURCE, satelliteSource(key));
    if (!map.getLayer(SATELLITE_SOURCE))
      map.addLayer(
        {
          id: SATELLITE_SOURCE,
          type: "raster",
          source: SATELLITE_SOURCE,
          paint: { "raster-fade-duration": 0 },
        },
        "highway_major_casing",
      );
  }
  if (map.getLayer(SATELLITE_SOURCE))
    map.setLayoutProperty(
      SATELLITE_SOURCE,
      "visibility",
      mode === "satellite" && key.trim() ? "visible" : "none",
    );
}
