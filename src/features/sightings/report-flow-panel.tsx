import { SignalIcon } from "./signal-icon";
import type { Dispatch } from "react";
import type { ReportFlowAction, ReportFlowState } from "./report-flow";
import { getCategoryMeta, SIGHTING_CATEGORIES } from "./sightings";

interface ReportPanelProps {
  state: ReportFlowState;
  onDispatch: Dispatch<ReportFlowAction>;
}

const steps = ["TYPE", "LOCATION", "CONTEXT", "REVIEW"] as const;

function ReportProgress({ phase }: { phase: ReportFlowState["phase"] }) {
  const current = phase === "category" ? 0 : phase === "location" ? 1 : phase === "context" ? 2 : 3;
  if (phase === "success" || phase === "error") return null;
  return (
    <ol className="report-progress" aria-label="Report progress">
      {steps.map((label, index) => (
        <li
          key={label}
          aria-current={index === current ? "step" : undefined}
          data-complete={index < current}
        >
          <span aria-hidden="true">{index < current ? "✓" : index + 1}</span>
          <strong>{label}</strong>
        </li>
      ))}
    </ol>
  );
}

export function ReportFlowPanel({ state, onDispatch }: ReportPanelProps) {
  const meta = state.category ? getCategoryMeta(state.category) : null;
  return (
    <div className="report-panel">
      <ReportProgress phase={state.phase} />
      {state.phase === "category" && (
        <>
          <p className="terminal-copy">CHOOSE THE SIGNAL THAT BEST FITS THE ROAD.</p>
          <div className="category-grid">
            {SIGHTING_CATEGORIES.map((category) => (
              <button
                key={category.category}
                type="button"
                className={`category-choice category-choice--${category.tone}`}
                onClick={() => onDispatch({ type: "select-category", category: category.category })}
              >
                <SignalIcon category={category.category} />
                <span>{category.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {state.phase === "location" && (
        <>
          <p className="report-selected-category">{meta?.label}</p>
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
        </>
      )}
      {state.phase === "context" && (
        <>
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
            aria-describedby="report-note-guidance report-note-count"
          />
          <div className="report-note-meta">
            <p id="report-note-guidance" className="terminal-muted">
              KEEP IT ABOUT THE ROAD, NOT THE PERSON.
            </p>
            <span id="report-note-count" className="terminal-status">
              {state.note.length}/280
            </span>
          </div>
        </>
      )}
      {state.phase === "review" && (
        <>
          <p className="terminal-copy">CHECK THE SIGNAL BEFORE SENDING.</p>
          <dl className="report-review">
            <div>
              <dt>CATEGORY</dt>
              <dd>{meta?.label}</dd>
            </div>
            <div>
              <dt>REPORT LOCATION</dt>
              <dd>
                {state.location?.lat.toFixed(4)}, {state.location?.lng.toFixed(4)}
              </dd>
            </div>
            {state.note && (
              <div>
                <dt>NOTE</dt>
                <dd className="report-review__note">{state.note}</dd>
              </div>
            )}
          </dl>
        </>
      )}
      {state.phase === "submitting" && (
        <p className="report-feedback" role="status">
          SENDING SIGHTING...
        </p>
      )}
      {state.phase === "success" && (
        <div className="report-feedback report-feedback--success" role="status">
          <span aria-hidden="true">✓</span>
          <p>SIGHTING SENT. IT IS NOW COMMUNITY REPORTED.</p>
        </div>
      )}
      {state.phase === "error" && (
        <div className="report-feedback report-feedback--error" role="alert">
          <span aria-hidden="true">!</span>
          <p>{state.error ?? "SIGHTING COULD NOT BE SENT."}</p>
        </div>
      )}
    </div>
  );
}

export function ReportFlowActions({
  state,
  onDispatch,
  onSubmit,
  onClose,
}: ReportPanelProps & { onSubmit: () => void; onClose: () => void }) {
  if (state.phase === "category") return null;
  if (state.phase === "success")
    return (
      <button type="button" className="terminal-action terminal-action--primary" onClick={onClose}>
        BACK TO MAP
      </button>
    );
  if (state.phase === "error")
    return (
      <button
        type="button"
        className="terminal-action terminal-action--primary"
        onClick={() => onDispatch({ type: "back" })}
      >
        TRY AGAIN
      </button>
    );
  if (state.phase === "submitting")
    return (
      <button type="button" className="terminal-action terminal-action--primary" disabled>
        SENDING...
      </button>
    );
  return (
    <>
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
        onClick={state.phase === "review" ? onSubmit : () => onDispatch({ type: "next" })}
      >
        {state.phase === "location"
          ? "CONFIRM LOCATION"
          : state.phase === "context"
            ? "REVIEW"
            : "SEND SIGHTING"}
      </button>
    </>
  );
}
