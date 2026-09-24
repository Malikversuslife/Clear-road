import type { ReportCategory } from "@/types";
import type { GeoPoint } from "@/types";

export type ReportFlowPhase =
  "closed" | "category" | "location" | "context" | "review" | "submitting" | "success" | "error";

export interface ReportFlowState {
  phase: ReportFlowPhase;
  category: ReportCategory | null;
  location: GeoPoint | null;
  note: string;
  error: string | null;
}

export const CLOSED_REPORT_FLOW: ReportFlowState = {
  phase: "closed",
  category: null,
  location: null,
  note: "",
  error: null,
};

export function startReportFlow(location: GeoPoint): ReportFlowState {
  return { ...CLOSED_REPORT_FLOW, phase: "category", location };
}

export type ReportFlowAction =
  | { type: "start"; location: GeoPoint }
  | { type: "select-category"; category: ReportCategory }
  | { type: "set-location"; location: GeoPoint }
  | { type: "set-note"; note: string }
  | { type: "next" }
  | { type: "back" }
  | { type: "submit" }
  | { type: "success" }
  | { type: "error"; message: string }
  | { type: "close" };

export function reportFlowReducer(
  state: ReportFlowState,
  action: ReportFlowAction,
): ReportFlowState {
  switch (action.type) {
    case "start":
      return startReportFlow(action.location);
    case "select-category":
      return { ...state, category: action.category, phase: "location", error: null };
    case "set-location":
      return { ...state, location: action.location, error: null };
    case "set-note":
      return { ...state, note: action.note, error: null };
    case "next":
      if (state.phase === "location" && state.location) return { ...state, phase: "context" };
      if (state.phase === "context") return { ...state, phase: "review" };
      return state;
    case "back":
      if (state.phase === "location") return { ...state, phase: "category" };
      if (state.phase === "context") return { ...state, phase: "location" };
      if (state.phase === "review") return { ...state, phase: "context" };
      return state;
    case "submit":
      return state.phase === "review" ? { ...state, phase: "submitting", error: null } : state;
    case "success":
      return { ...state, phase: "success", error: null };
    case "error":
      return { ...state, phase: "error", error: action.message };
    case "close":
      return CLOSED_REPORT_FLOW;
  }
}
