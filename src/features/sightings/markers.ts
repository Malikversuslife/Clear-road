import { SIGNAL_ICON_PATHS } from "./signal-paths";
import { getCategoryMeta, type PublicSighting } from "./sightings";

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
  svg.setAttribute("viewBox", "0 0 32 32");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("sighting-marker__glyph");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", SIGNAL_ICON_PATHS[sighting.category]);
  path.setAttribute("fill", "currentColor");
  path.setAttribute("fill-rule", "evenodd");
  svg.append(path);
  button.append(svg);
  return button;
}
