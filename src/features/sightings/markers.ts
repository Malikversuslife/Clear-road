import { getCategoryMeta, type PublicSighting } from "./sightings";

const glyphPaths = {
  signal: "M5 19V9m7 10V5m7 14v-7M3 21h18",
  gate: "M3 21V6h18v15M8 6v15M16 6v15M3 11h18",
  alert: "M12 3 22 21H2L12 3Zm0 6v5m0 3v1",
  bars: "M3 6h18M3 12h14M3 18h9",
  wave: "M2 9c3-4 5 4 8 0s5 4 8 0 5 4 8 0M2 16c3-4 5 4 8 0s5 4 8 0 5 4 8 0",
  diamond: "m12 2 9 10-9 10-9-10 9-10Zm0 5v6m0 3v1",
} as const;

export function createSightingMarkerElement(
  sighting: PublicSighting,
  onSelect: (id: string) => void,
): HTMLButtonElement {
  const meta = getCategoryMeta(sighting.category);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `sighting-marker sighting-marker--${meta.tone}`;
  button.dataset.category = sighting.category;
  button.setAttribute("aria-label", `${meta.label}, ${sighting.reporterLabel}`);
  button.title = meta.label;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onSelect(sighting.id);
  });

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("sighting-marker__glyph");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", glyphPaths[meta.shape]);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-linecap", "square");
  path.setAttribute("stroke-linejoin", "miter");
  path.setAttribute("stroke-width", meta.shape === "alert" ? "2.5" : "2");
  svg.append(path);
  button.append(svg);
  return button;
}
