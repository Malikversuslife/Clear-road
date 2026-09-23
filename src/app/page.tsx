import { MapShell } from "../features/map/map-shell";

export const metadata = {
  title: "Clear Road - Lagos live map",
  description:
    "Clear Road - the Lagos night map. Ephemeral, explicit-only locate. See what is ahead.",
};

export default function HomePage() {
  // h-dvh (not min-h-screen): a definite parent height is required for the
  // MapShell `h-full` cascade, otherwise the map container collapses to 0 and
  // Maplibre falls back to a 300px default canvas (blank navy slab + controls
  // floating off its bounds). Regression-checked via browser CDP.
  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-night-950 text-cream">
      <MapShell accent="lime" />
    </main>
  );
}
