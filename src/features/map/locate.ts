export type LocatePhase = "idle" | "requesting" | "available" | "denied" | "unavailable";

export interface LocatePosition {
  latitude: number;
  longitude: number;
  /** Horizontal accuracy in metres; null when not reported. */
  accuracy: number | null;
  /** Epoch millis; used only to stamp recency in the UI, never stored. */
  timestamp: number;
}

export type LocateFailureReason =
  "permission-denied" | "position-unavailable" | "timeout" | "unsupported" | "error";

export interface LocateState {
  phase: LocatePhase;
  position: LocatePosition | null;
  failure: LocateFailureReason | null;
}

export const INITIAL_LOCATE_STATE: LocateState = {
  phase: "idle",
  position: null,
  failure: null,
};

export type LocateAction =
  | { type: "request" }
  | { type: "succeed"; position: LocatePosition }
  | { type: "fail"; reason: LocateFailureReason };

/** DOM GeolocationPositionError codes → our failure vocabulary. */
export function classifyGeolocationFailure(
  error: Pick<GeolocationPositionError, "code"> | null | undefined,
): LocateFailureReason {
  switch (error?.code) {
    case 1:
      return "permission-denied";
    case 2:
      return "position-unavailable";
    case 3:
      return "timeout";
    default:
      return "error";
  }
}

/** Browser fix → our (never-persisted) model value. */
export function toLocatePosition(position: GeolocationPosition): LocatePosition {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
    timestamp: position.timestamp,
  };
}

/**
 * Pure transition function. `request` is only honoured from `idle` (or
 * `available`, where it points Level One at a fresher fix — still one discrete
 * call, never a watch). Denial/unavailability are first-class, non-blocking
 * states; the map stays fully usable in every phase.
 */
export function locateReducer(state: LocateState, action: LocateAction): LocateState {
  switch (action.type) {
    case "request":
      if (state.phase === "idle" || state.phase === "available") {
        return { ...state, phase: "requesting", failure: null };
      }
      return state;
    case "succeed":
      // Honoured only while an explicit request is actually in flight - a fix
      // can never be injected into denied/unavailable from an old callback.
      if (state.phase !== "requesting") return state;
      return { phase: "available", position: action.position, failure: null };
    case "fail":
      return {
        phase: action.reason === "permission-denied" ? "denied" : "unavailable",
        position: null,
        failure: action.reason,
      };
    default:
      return state;
  }
}
