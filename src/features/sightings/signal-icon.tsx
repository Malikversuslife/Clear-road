import type { ReportCategory } from "@/types";
import { SIGNAL_ICON_PATHS } from "./signal-paths";

/** Category labels provide the accessible name; the pictogram is decorative. */
export function SignalIcon({ category }: { category: ReportCategory }) {
  return (
    <svg
      className="signal-icon"
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={SIGNAL_ICON_PATHS[category]} fillRule="evenodd" />
    </svg>
  );
}
