import type { BasemapMode } from "@/features/map/basemap";

/** Original Clear Road device chrome. Decoration carries no live-data claims. */
export function DeviceHeader({
  areaName,
  basemap,
  onBasemapChange,
  satelliteAvailable,
}: {
  areaName: string;
  basemap: BasemapMode;
  onBasemapChange: (mode: BasemapMode) => void;
  satelliteAvailable: boolean;
}) {
  return (
    <header className={`device-header ${satelliteAvailable ? "device-header--switcher" : ""}`}>
      <div className="device-brand">
        <h1>CLEAR ROAD</h1>
        <p>SEE WHAT&apos;S AHEAD.</p>
      </div>
      <div className="device-header__tools">
        <div
          className="device-city"
          aria-label={`Viewing ${areaName}`}
          title={`Viewing ${areaName}`}
        >
          <span className="device-city__dot" aria-hidden="true" />
          <span className="device-city__name">{areaName}</span>
          <span className="device-city__caption">COMMUNITY MAP</span>
        </div>
        {satelliteAvailable && (
          <div className="basemap-switch" role="group" aria-label="Map view">
            <button
              type="button"
              aria-pressed={basemap === "map"}
              onClick={() => onBasemapChange("map")}
            >
              MAP
            </button>
            <button
              type="button"
              aria-pressed={basemap === "satellite"}
              onClick={() => onBasemapChange("satellite")}
            >
              SATELLITE
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export function LocateIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 1v5m0 12v5M1 12h5m12 0h5" />
    </svg>
  );
}
