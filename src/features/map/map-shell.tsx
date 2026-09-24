"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useReducer, useRef, useState, type Dispatch } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { DEFAULT_VIEWPORT } from "./config";
import { useGeolocation } from "./use-geolocation";
import {
  createSighting,
  fetchNearbySightings,
  isLatestViewportRequest,
  reportErrorMessage,
  type SightingsViewport,
} from "../sightings/client";
import {
  confidenceLabel,
  formatRelativeAge,
  getCategoryMeta,
  emptySightingsCopy,
  roundReportLocation,
  SIGHTING_CATEGORIES,
  type PublicSighting,
} from "../sightings/sightings";
import {
  CLOSED_REPORT_FLOW,
  reportFlowReducer,
  type ReportFlowAction,
} from "../sightings/report-flow";
import { validateCreateReport } from "../reports/validation";
import type { GeoPoint } from "@/types";

const MapView = dynamic(() => import("./map-view").then((m) => m.MapView), {
  ssr: false,
});

type SightingsStatus = "idle" | "loading" | "ready" | "empty" | "unavailable";

export interface MapShellProps {
  /** Brand accent hue (Tailwind color token name) for the locate chip. */
  accent: string;
}

export function MapShell({ accent }: MapShellProps) {
  const { state: locationState, request: requestLocation } = useGeolocation();
  const [sightings, setSightings] = useState<PublicSighting[]>([]);
  const [selectedSightingId, setSelectedSightingId] = useState<string | null>(null);
  const [sightingsStatus, setSightingsStatus] = useState<SightingsStatus>("idle");
  const [reportFlow, dispatchReport] = useReducer(reportFlowReducer, CLOSED_REPORT_FLOW);
  const viewportRef = useRef<SightingsViewport | null>(null);
  const requestSequenceRef = useRef(0);
  const fetchTimerRef = useRef<number | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);

  const fetchSightings = useCallback((viewport: SightingsViewport) => {
    viewportRef.current = viewport;
    if (fetchTimerRef.current !== null) window.clearTimeout(fetchTimerRef.current);
    fetchAbortRef.current?.abort();
    const sequence = ++requestSequenceRef.current;
    fetchTimerRef.current = window.setTimeout(async () => {
      const client = getSupabaseBrowserClient();
      if (!client) {
        setSightingsStatus("unavailable");
        return;
      }
      const controller = new AbortController();
      fetchAbortRef.current = controller;
      setSightingsStatus("loading");
      try {
        const nextSightings = await fetchNearbySightings(client, viewport, controller.signal);
        if (!isLatestViewportRequest(sequence, requestSequenceRef.current)) return;
        setSightings(nextSightings);
        setSightingsStatus(nextSightings.length > 0 ? "ready" : "empty");
        setSelectedSightingId((current) =>
          current && nextSightings.some((sighting) => sighting.id === current) ? current : null,
        );
      } catch {
        if (
          controller.signal.aborted ||
          !isLatestViewportRequest(sequence, requestSequenceRef.current)
        )
          return;
        setSightingsStatus("unavailable");
      }
    }, 250);
  }, []);

  useEffect(
    () => () => {
      if (fetchTimerRef.current !== null) window.clearTimeout(fetchTimerRef.current);
      fetchAbortRef.current?.abort();
    },
    [],
  );

  const selectedSighting = sightings.find((sighting) => sighting.id === selectedSightingId) ?? null;
  const reportPlacementMode = reportFlow.phase === "location";
  const reportLocation = reportFlow.location;

  const startReport = useCallback(() => {
    const viewport = viewportRef.current;
    const location: GeoPoint = viewport
      ? { lat: viewport.lat, lng: viewport.lng }
      : { lat: DEFAULT_VIEWPORT.center[1], lng: DEFAULT_VIEWPORT.center[0] };
    setSelectedSightingId(null);
    dispatchReport({ type: "start", location: roundReportLocation(location) });
  }, []);

  const closeReport = useCallback(() => {
    dispatchReport({ type: "close" });
  }, []);

  const setReportLocation = useCallback((location: GeoPoint) => {
    dispatchReport({ type: "set-location", location: roundReportLocation(location) });
  }, []);

  const submitReport = useCallback(async () => {
    if (!reportFlow.category || !reportFlow.location) return;
    const validation = validateCreateReport({
      category: reportFlow.category,
      location: reportFlow.location,
      note: reportFlow.note,
    });
    if (!validation.ok) {
      dispatchReport({ type: "error", message: validation.error });
      return;
    }
    const client = getSupabaseBrowserClient();
    if (!client) {
      dispatchReport({ type: "error", message: "REPORTING IS NOT AVAILABLE RIGHT NOW." });
      return;
    }
    dispatchReport({ type: "submit" });
    try {
      const created = await createSighting(client, validation.value);
      dispatchReport({ type: "success" });
      setSightings((current) => [
        created,
        ...current.filter((sighting) => sighting.id !== created.id),
      ]);
      setSelectedSightingId(created.id);
      if (viewportRef.current) fetchSightings(viewportRef.current);
    } catch (error) {
      dispatchReport({ type: "error", message: reportErrorMessage(error) });
    }
  }, [fetchSightings, reportFlow]);

  const reportIsOpen = reportFlow.phase !== "closed";
  const sheetTitle = reportIsOpen
    ? reportFlow.phase === "success"
      ? "SIGNAL SENT"
      : reportFlow.phase === "category"
        ? "WHAT'S AHEAD?"
        : "REPORT SIGHTING"
    : selectedSighting
      ? "SIGHTING DETAIL"
      : "SIGHTINGS NEARBY";

  return (
    <div
      className="map-shell relative min-h-0 w-full overflow-hidden bg-night-950"
      style={{ flex: "1 1 0%", minHeight: 0 }}
    >
      <MapView
        accent={accent}
        sightings={sightings}
        selectedSightingId={selectedSightingId}
        onSelectSighting={setSelectedSightingId}
        onViewportChange={fetchSightings}
        reportPlacementMode={reportPlacementMode}
        reportLocation={reportLocation}
        onReportLocationChange={setReportLocation}
      />
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 flex items-start justify-between gap-3 pt-[max(0px,env(safe-area-inset-top))]">
        <div className="pointer-events-auto">
          <p className="font-mono text-[13px] font-bold uppercase tracking-[0.42em] text-cream drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            Clear Road
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-lime/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            see what&apos;s ahead.
          </p>
        </div>
      </div>
      <div className="map-locate-control absolute right-[max(1rem,env(safe-area-inset-right))] z-20 flex flex-col items-end gap-3">
        <button
          type="button"
          onClick={requestLocation}
          disabled={locationState.phase === "requesting"}
          className="flex items-center gap-2 border-2 border-lime bg-lime px-4 py-2 font-mono text-xs uppercase tracking-[0.3em] text-night-950 shadow-[0_0_18px_rgba(190,242,100,0.35)] transition hover:border-cream disabled:cursor-wait disabled:opacity-60"
        >
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-night-950" />
          {locationState.phase === "requesting" ? "fixing..." : "locate me"}
        </button>
      </div>
      <BottomSheet
        open
        title={sheetTitle}
        eyebrow={
          reportIsOpen && reportFlow.phase !== "success"
            ? `STEP ${reportStep(reportFlow.phase)}`
            : undefined
        }
        onClose={
          reportIsOpen
            ? closeReport
            : selectedSighting
              ? () => setSelectedSightingId(null)
              : undefined
        }
        footer={
          !reportIsOpen && (
            <button
              type="button"
              className="terminal-action terminal-action--primary"
              onClick={startReport}
            >
              + REPORT
            </button>
          )
        }
      >
        {reportIsOpen ? (
          <ReportFlowPanel
            state={reportFlow}
            onDispatch={dispatchReport}
            onSubmit={submitReport}
            onClose={closeReport}
          />
        ) : selectedSighting ? (
          <SightingDetail sighting={selectedSighting} />
        ) : (
          <NearbyPanel
            count={sightings.length}
            status={sightingsStatus}
            onRefresh={() => viewportRef.current && fetchSightings(viewportRef.current)}
          />
        )}
      </BottomSheet>
    </div>
  );
}

function reportStep(phase: string): string {
  if (phase === "category") return "A / 4";
  if (phase === "location") return "B / 4";
  if (phase === "context") return "C / 4";
  return "D / 4";
}

function NearbyPanel({
  count,
  status,
  onRefresh,
}: {
  count: number;
  status: SightingsStatus;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <p className="terminal-count">
          <strong>{String(count).padStart(2, "0")}</strong> IN VIEW
        </p>
        {status === "loading" && <span className="terminal-status">UPDATING</span>}
      </div>
      {status === "idle" || status === "loading" ? (
        <p className="terminal-copy">SCANNING THE VISIBLE MAP...</p>
      ) : status === "unavailable" ? (
        <div className="space-y-2">
          <p className="terminal-copy terminal-copy--caution">
            SIGHTINGS ARE UNAVAILABLE. THE MAP IS STILL LIVE.
          </p>
          <button type="button" className="terminal-action" onClick={onRefresh}>
            RETRY SCAN
          </button>
        </div>
      ) : count === 0 ? (
        <div className="space-y-1">
          <p className="terminal-copy">{emptySightingsCopy().title}</p>
          <p className="terminal-muted">{emptySightingsCopy().detail}</p>
        </div>
      ) : (
        <p className="terminal-copy">SELECT A SIGNAL ON THE MAP TO INSPECT IT.</p>
      )}
    </div>
  );
}

function SightingDetail({ sighting }: { sighting: PublicSighting }) {
  const meta = getCategoryMeta(sighting.category);
  return (
    <div className="space-y-3">
      <div className={`terminal-category terminal-category--${meta.tone}`}>
        <span className={`category-glyph category-glyph--${meta.shape}`} aria-hidden="true" />
        <div>
          <p className="terminal-eyebrow">COMMUNITY REPORTED</p>
          <h3 className="terminal-heading">{meta.label}</h3>
        </div>
      </div>
      <div className="terminal-detail-grid">
        <span>AGE</span>
        <strong>{formatRelativeAge(sighting.createdAt)}</strong>
        <span>CONFIDENCE</span>
        <strong className="terminal-confidence">{confidenceLabel(sighting.confidence)}</strong>
        <span>REPORTER</span>
        <strong>{sighting.reporterLabel}</strong>
        <span>LOCATION</span>
        <strong>
          {sighting.location.lat.toFixed(4)}, {sighting.location.lng.toFixed(4)}
        </strong>
      </div>
      {sighting.note && <p className="terminal-note">&quot;{sighting.note}&quot;</p>}
      <p className="terminal-muted">
        A SIGHTING IS A COMMUNITY REPORT, NOT INDEPENDENT VERIFICATION.
      </p>
    </div>
  );
}

function ReportFlowPanel({
  state,
  onDispatch,
  onSubmit,
  onClose,
}: {
  state: ReturnType<typeof reportFlowReducer>;
  onDispatch: Dispatch<ReportFlowAction>;
  onSubmit: () => void;
  onClose: () => void;
}) {
  if (state.phase === "category") {
    return (
      <div className="space-y-3">
        <p className="terminal-copy">CHOOSE THE SIGNAL THAT BEST FITS THE ROAD.</p>
        <div className="category-grid">
          {SIGHTING_CATEGORIES.map((meta) => (
            <button
              key={meta.category}
              type="button"
              className={`category-choice category-choice--${meta.tone}`}
              onClick={() => onDispatch({ type: "select-category", category: meta.category })}
            >
              <span className={`category-glyph category-glyph--${meta.shape}`} aria-hidden="true" />
              <span>{meta.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (state.phase === "location") {
    return (
      <div className="space-y-3">
        <p className="terminal-copy">TAP THE MAP TO PLACE THE SIGHTING.</p>
        <p className="terminal-muted">
          REPORT LOCATION IS SEPARATE FROM YOUR LOCATION. GPS IS NOT REQUIRED.
        </p>
        <div className="terminal-coordinate">
          <span>REPORT LOCATION</span>
          <strong>
            {state.location?.lat.toFixed(4)}, {state.location?.lng.toFixed(4)}
          </strong>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="terminal-action"
            onClick={() => onDispatch({ type: "back" })}
          >
            BACK
          </button>
          <button
            type="button"
            className="terminal-action terminal-action--primary"
            onClick={() => onDispatch({ type: "next" })}
          >
            CONFIRM LOCATION
          </button>
        </div>
      </div>
    );
  }
  if (state.phase === "context") {
    return (
      <div className="space-y-3">
        <label className="terminal-label" htmlFor="sighting-note">
          OPTIONAL CONTEXT
        </label>
        <textarea
          id="sighting-note"
          className="terminal-textarea"
          maxLength={280}
          value={state.note}
          onChange={(event) => onDispatch({ type: "set-note", note: event.target.value })}
          placeholder="What should another driver know?"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="terminal-muted">KEEP IT ABOUT THE ROAD, NOT THE PERSON.</p>
          <span className="terminal-status">{state.note.length}/280</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="terminal-action"
            onClick={() => onDispatch({ type: "back" })}
          >
            BACK
          </button>
          <button
            type="button"
            className="terminal-action terminal-action--primary"
            onClick={() => onDispatch({ type: "next" })}
          >
            REVIEW
          </button>
        </div>
      </div>
    );
  }
  if (state.phase === "review") {
    const meta = state.category ? getCategoryMeta(state.category) : null;
    return (
      <div className="space-y-3">
        <p className="terminal-copy">CHECK THE SIGNAL BEFORE SENDING.</p>
        <div className="terminal-review">
          <span>CATEGORY</span>
          <strong>{meta?.label}</strong>
          <span>REPORT LOCATION</span>
          <strong>
            {state.location?.lat.toFixed(4)}, {state.location?.lng.toFixed(4)}
          </strong>
          {state.note && (
            <>
              <span>NOTE</span>
              <strong>{state.note}</strong>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="terminal-action"
            onClick={() => onDispatch({ type: "back" })}
          >
            BACK
          </button>
          <button
            type="button"
            className="terminal-action terminal-action--primary"
            onClick={onSubmit}
          >
            SEND SIGHTING
          </button>
        </div>
      </div>
    );
  }
  if (state.phase === "submitting") return <p className="terminal-copy">SENDING SIGHTING...</p>;
  if (state.phase === "success") {
    return (
      <div className="space-y-3">
        <p className="terminal-copy terminal-copy--success">
          SIGHTING SENT. IT IS NOW COMMUNITY REPORTED.
        </p>
        <button
          type="button"
          className="terminal-action terminal-action--primary"
          onClick={onClose}
        >
          BACK TO MAP
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="terminal-copy terminal-copy--caution">
        {state.error ?? "SIGHTING COULD NOT BE SENT."}
      </p>
      <button
        type="button"
        className="terminal-action"
        onClick={() => onDispatch({ type: "back" })}
      >
        TRY AGAIN
      </button>
    </div>
  );
}
