/** Original Clear Road device chrome. Decoration carries no live-data claims. */
export function DeviceHeader() {
  return (
    <header className="device-header">
      <div className="device-brand">
        <h1>CLEAR ROAD</h1>
        <p>SEE WHAT&apos;S AHEAD.</p>
      </div>
      <div className="device-city">
        <span aria-hidden="true">↗</span> LAGOS
        <span className="device-city__caption">COMMUNITY MAP</span>
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
