import type { ReportCategory } from "@/types";

/** Original Clear Road silhouettes, shared by React panels and MapLibre DOM markers. */
export const SIGNAL_ICON_PATHS: Record<ReportCategory, string> = {
  police_presence:
    "M6 6 16 2 26 6 24 10H8Zm5 5h10v4a5 5 0 0 1-10 0Zm-1 10 6 3 6-3c4 1 6 4 6 8v1H4v-1c0-4 2-7 6-8Zm5 3-1 4 2 2 2-2-1-4Zm7 1h3v3h-3Z",
  checkpoint_roadblock:
    "M3 8h26v12H3Zm4 3-3 6h4l3-6Zm8 0-3 6h4l3-6Zm8 0-3 6h4l3-6ZM6 21h4v8H6Zm16 0h4v8h-4Z",
  accident:
    "M8 12h16l3 7 2 2v7h-4v2h-4v-2H11v2H7v-2H3v-7l2-2Zm2 3-2 5h16l-2-5ZM6 23v2h5v-2Zm15 0v2h5v-2ZM15 2h3v6h-3ZM4 5l3-1 3 5-3 1Zm22-1 3 1-3 5-3-1Z",
  heavy_traffic:
    "M16 3h10l3 7v9h-3v2h-3v-3h3v-5h-9v-3h9l-2-4h-6l-2 4h-3Zm-10 11h11l4 8v7h-3v2h-4v-2H7v2H3v-2H1v-7Zm2 3-2 5h11l-2-5ZM4 24v2h4v-2Zm10 0v2h4v-2Z",
  flooded_road:
    "M3 7c4-5 7-5 11-2s6 3 10-1l5 3c-5 5-9 6-14 2S8 7 3 11Zm0 9c4-5 7-5 11-2s6 3 10-1l5 3c-5 5-9 6-14 2s-7-2-12 2Zm0 9c4-5 7-5 11-2s6 3 10-1l5 3c-5 5-9 6-14 2s-7-2-12 2Z",
  road_hazard: "M16 2 31 29H1Zm0 6L6 26h20Zm-2 5h4l-1 7h-2Zm0 9h4v3h-4Z",
};
