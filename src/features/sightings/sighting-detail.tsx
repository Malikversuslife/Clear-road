import { SignalIcon } from "./signal-icon";
import {
  confidenceLabel,
  formatRelativeAge,
  getCategoryMeta,
  type PublicSighting,
} from "./sightings";

/** Presentation only: all values come from the existing public report contract. */
export function SightingDetail({
  sighting,
  locationLabel = "PINNED LOCATION",
}: {
  sighting: PublicSighting;
  locationLabel?: string;
}) {
  const meta = getCategoryMeta(sighting.category);
  return (
    <article className="sighting-detail" aria-label={meta.label}>
      <div className="sighting-detail__identity">
        <div
          className={"sighting-detail__badge sighting-detail__badge--" + meta.tone}
          aria-hidden="true"
        >
          <SignalIcon category={sighting.category} />
        </div>
        <div>
          <p className="sighting-detail__eyebrow">COMMUNITY REPORTED</p>
          <h3 className="sighting-detail__title">{meta.label}</h3>
        </div>
      </div>
      <dl className="sighting-detail__facts">
        <div>
          <dt>AGE</dt>
          <dd>{formatRelativeAge(sighting.createdAt)}</dd>
        </div>
        <div>
          <dt>REPORTER</dt>
          <dd>{sighting.reporterLabel}</dd>
        </div>
        <div className="sighting-detail__confidence">
          <dt>CONFIDENCE</dt>
          <dd>{confidenceLabel(sighting.confidence)}</dd>
        </div>
        <div className="sighting-detail__location">
          <dt>REPORT LOCATION</dt>
          <dd>{locationLabel}</dd>
        </div>
      </dl>
      {sighting.note && (
        <div className="sighting-detail__note">
          <p className="sighting-detail__eyebrow">REPORTER&apos;S NOTE</p>
          <p>{sighting.note}</p>
        </div>
      )}
      <p className="sighting-detail__disclaimer">
        A sighting is a community report, not independent verification.
      </p>
    </article>
  );
}
