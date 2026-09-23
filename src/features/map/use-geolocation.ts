"use client";

import { useCallback, useEffect, useState } from "react";
import {
  classifyGeolocationFailure,
  locateReducer,
  toLocatePosition,
  type LocateState,
} from "./locate";
import { LOCATE_TIMEOUT_MS } from "./config";

export interface GeolocationAccess {
  /** Fire one discrete fix request. Only caller is a user press. */
  request: () => void;
  state: LocateState;
}

/**
 * Browser adapter for the Clear Road locate state machine.
 *
 * Privacy contract (locked by code + tests):
 *  - Explicit action only: the browser fix runs inside an effect keyed on
 *    `phase === "requesting"`, and that phase is reached *only* by
 *    `request()` - which the UI calls from a button press alone. Nothing runs
 *    on mount / focus / visibilitychange and nothing auto-starts.
 *  - Ephemeral: the fix lives in React state (memory) only - no
 *    localStorage / sessionStorage / cookies and no Supabase write.
 *  - One discrete `getCurrentPosition`, never `watchPosition` (no continuous
 *    tracking), bounded by {@link LOCATE_TIMEOUT_MS}.
 *  - Unsupported browsers and denials surface as first-class states so the
 *    control tells the truth without ever blocking the map.
 */
export function useGeolocation(): GeolocationAccess {
  const [state, setState] = useState<LocateState>({
    phase: "idle",
    position: null,
    failure: null,
  });

  const request = useCallback((): void => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((current) => locateReducer(current, { type: "fail", reason: "unsupported" }));
      return;
    }
    setState((current) => locateReducer(current, { type: "request" }));
  }, []);

  useEffect(() => {
    if (state.phase !== "requesting") return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        setState((current) =>
          locateReducer(current, {
            type: "succeed",
            position: toLocatePosition(position),
          }),
        );
      },
      (error) => {
        if (cancelled) return;
        setState((current) =>
          locateReducer(current, {
            type: "fail",
            reason: classifyGeolocationFailure(error),
          }),
        );
      },
      { enableHighAccuracy: false, timeout: LOCATE_TIMEOUT_MS, maximumAge: 0 },
    );

    return () => {
      cancelled = true;
    };
  }, [state.phase]);

  return { request, state };
}
