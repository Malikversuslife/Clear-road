"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ReportFlowPanel, ReportFlowActions } from "../sightings/report-flow-panel";
import { SightingDetail } from "../sightings/sighting-detail";
import { DeviceHeader, LocateIcon } from "@/components/device-chrome";
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
  emptySightingsCopy,
  roundReportLocation,
  type PublicSighting,
} from "../sightings/sightings";
import { CLOSED_REPORT_FLOW, reportFlowReducer } from "../sightings/report-flow";
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
      className={`map-shell device-frame relative min-h-0 w-full overflow-hidden bg-night-950 ${!reportIsOpen ? (selectedSighting ? "device-frame--detail" : "device-frame--nearby") : "device-frame--report"}`}
      data-report-phase={reportFlow.phase}
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
      <DeviceHeader />
      <div className="map-locate-control absolute right-[max(1rem,env(safe-area-inset-right))] z-20 flex flex-col items-end gap-3">
        <button
          type="button"
          onClick={requestLocation}
          disabled={locationState.phase === "requesting"}
          className="device-button device-button--lime"
        >
          <LocateIcon />
          {locationState.phase === "requesting" ? "fixing..." : "locate me"}
        </button>
      </div>
      <BottomSheet
        open
        title={sheetTitle}
        onClose={
          reportIsOpen
            ? closeReport
            : selectedSighting
              ? () => setSelectedSightingId(null)
              : undefined
        }
        footer={
          reportIsOpen ? (
            reportFlow.phase !== "category" && (
              <ReportFlowActions
                state={reportFlow}
                onDispatch={dispatchReport}
                onSubmit={submitReport}
                onClose={closeReport}
              />
            )
          ) : (
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
          <ReportFlowPanel state={reportFlow} onDispatch={dispatchReport} />
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
