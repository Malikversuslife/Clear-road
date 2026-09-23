import { describe, expect, it } from "vitest";
import {
  classifyGeolocationFailure,
  INITIAL_LOCATE_STATE,
  locateReducer,
  toLocatePosition,
} from "./locate";

/**
 * M1 locate privacy contract, tested as behaviour (not prose):
 *
 *  - `request` is only ever accepted from the user button on CLIENT side; the
 *    reducer accepts it from `idle`/`available` and refuses re-entry while
 *    `requesting` (one discrete request, never a watch).
 *  - A fix lives in reducer memory only — the reducer never writes storage.
 *  - `denied` stays denial; the map keeps working (no permission hostage).
 */

describe("locateReducer — explicit, ephemeral, one-shot", () => {
  it("starts idle with no position and no failure", () => {
    expect(INITIAL_LOCATE_STATE).toEqual({
      phase: "idle",
      position: null,
      failure: null,
    });
  });

  it("request from idle → requesting, carrying no data yet", () => {
    const next = locateReducer(INITIAL_LOCATE_STATE, { type: "request" });
    expect(next.phase).toBe("requesting");
    expect(next.position).toBeNull();
    expect(next.failure).toBeNull();
  });

  it("request is ignored while already requesting (single discrete request)", () => {
    const requesting = locateReducer(INITIAL_LOCATE_STATE, { type: "request" });
    const again = locateReducer(requesting, { type: "request" });
    expect(again.phase).toBe("requesting");
    expect(again).toBe(requesting);
  });

  it("available position from a newer request is permitted (explicit refix)", () => {
    const avail = locateReducer(INITIAL_LOCATE_STATE, { type: "request" });
    const fresh = locateReducer(avail, {
      type: "request",
    });
    expect(fresh.phase).toBe("requesting");
  });

  it("succeed → available, position carried, failure cleared", () => {
    const fix = {
      latitude: 6.5244,
      longitude: 3.3792,
      accuracy: 42,
      timestamp: 1_700_000_000_000,
    };
    const next = locateReducer(
      { phase: "requesting", position: null, failure: null },
      { type: "succeed", position: fix },
    );
    expect(next).toEqual({ phase: "available", position: fix, failure: null });
  });

  it("fail with permission-denied → denied, position dropped, map stays alive", () => {
    const next = locateReducer(
      { phase: "requesting", position: null, failure: null },
      { type: "fail", reason: "permission-denied" },
    );
    expect(next.phase).toBe("denied");
    expect(next.position).toBeNull();
    expect(next.failure).toBe("permission-denied");
  });

  it("non-permission failures → unavailable with the honest reason", () => {
    for (const reason of ["position-unavailable", "timeout", "unsupported", "error"] as const) {
      const next = locateReducer(
        { phase: "requesting", position: null, failure: null },
        { type: "fail", reason },
      );
      expect(next.phase).toBe("unavailable");
      expect(next.failure).toBe(reason);
    }
  });

  it("denied requires a fresh explicit request to try again (no auto-retry)", () => {
    const denied = locateReducer(
      { phase: "requesting", position: null, failure: null },
      { type: "fail", reason: "permission-denied" },
    );
    const auto = { ...denied, phase: "denied" as const, position: null, failure: null };
    // subsequent succeed without an intervening explicit request stays denied
    const sneaky = locateReducer(auto, {
      type: "succeed",
      position: { latitude: 6, longitude: 3, accuracy: null, timestamp: 0 },
    });
    expect(sneaky.phase).toBe("denied");
    expect(sneaky.position).toBeNull();
  });
});

describe("classifyGeolocationFailure — DOM PO code → our vocabulary", () => {
  it("maps the three well-known codes", () => {
    expect(classifyGeolocationFailure({ code: 1 })).toBe("permission-denied");
    expect(classifyGeolocationFailure({ code: 2 })).toBe("position-unavailable");
    expect(classifyGeolocationFailure({ code: 3 })).toBe("timeout");
  });

  it("maps null/unknown codes to a generic, honest error", () => {
    expect(classifyGeolocationFailure(null)).toBe("error");
    expect(classifyGeolocationFailure({ code: 0 })).toBe("error");
    expect(classifyGeolocationFailure(undefined)).toBe("error");
  });
});

describe("toLocatePosition — browser fix → normalized model (memory only)", () => {
  it("maps coordinates, accuracy (empty stays null) and timestamp", () => {
    const native = {
      coords: { latitude: 6.5244, longitude: 3.3792, accuracy: 15 },
      timestamp: 1_700_000_000_000,
    } as GeolocationPosition;
    expect(toLocatePosition(native)).toEqual({
      latitude: 6.5244,
      longitude: 3.3792,
      accuracy: 15,
      timestamp: 1_700_000_000_000,
    });
  });

  it("keeps a missing accuracy as null", () => {
    const native = {
      coords: { latitude: 6.5, longitude: 3.4, accuracy: undefined },
      timestamp: 0,
    } as unknown as GeolocationPosition;
    expect(toLocatePosition(native).accuracy).toBeNull();
  });
});

/** Static privacy guard: the locate model must never touch persistence. */
describe("locate privacy — no persistence on any path", () => {
  it("reducer carries only ephemeral fields (no storage handles)", () => {
    const state = JSON.stringify(INITIAL_LOCATE_STATE);
    for (const banned of ["localStorage", "sessionStorage", "cookie", "supabase"]) {
      expect(state.toLowerCase().includes(banned)).toBe(false);
    }
  });
});
