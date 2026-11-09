/**
 * PartyInfoPanel — the DeckCard's info panel, unclamped: Quiet eyebrow,
 * title, host line, facts line. Everything a glance needs before the
 * grouped list takes over the details.
 *
 *  - Eyebrow ("Quiet", 2026-11-08): no boxes. Yellow `#1 tonight` text (a
 *    text colour only — no glow) while the top party is live or upcoming,
 *    a middle dot, then the category in muted 12px caps. `Other` shows
 *    nothing; a bare eyebrow renders nothing at all.
 *  - Title: ~26px in the host's own casing, balanced — no forced caps.
 *  - Host line: `by Host`, the static verified seal, the last-semester
 *    crown, then `90% liked · 9 parties` when hostStats exists. Long names
 *    wrap (never truncate); the marks ride inline. The crown is the one
 *    tappable mark here (it opens LastSemesterChampModal, DESIGN.md kit
 *    notes) and its hit area is padded out to 44px by the badge itself —
 *    which is why the seal beside it stays static: two padded targets 4px
 *    apart would overlap.
 *  - Facts line: the Deck's wording — `Doors 10 PM` / `Live now` / `Ended`
 *    · price · walk. Short prices ride inline; host prose gets its own line.
 */

import VerifiedMark from '@/components/ui/VerifiedMark';
import LastSemesterChampBadge from '@/components/LastSemesterChampBadge';
import type { Party } from '@/lib/types';
import type { PartyPageModel } from '@/utils/partyPage';

interface PartyInfoPanelProps {
  party: Party;
  model: PartyPageModel;
  /** Lets the verified seal explain itself on tap (phones have no tooltip). */
  onShowToast?: (message: string) => void;
}

export default function PartyInfoPanel({ party, model, onShowToast }: PartyInfoPanelProps) {
  return (
    <>
      <Eyebrow model={model} />
      <h1 className="text-balance break-words text-[26px] font-bold leading-[30px] [overflow-wrap:anywhere]">
        {party.title}
      </h1>
      <HostLine party={party} model={model} onShowToast={onShowToast} />
      <FactsLine model={model} />
    </>
  );
}

function Eyebrow({ model }: { model: PartyPageModel }) {
  const { topLabel, category } = model;
  if (!topLabel && !category) return null;
  return (
    <p className="mb-2 flex min-w-0 items-center gap-1.5 text-[12px] uppercase leading-4 tracking-[0.08em]">
      {topLabel && <span className="shrink-0 font-bold text-temple-hyped">{topLabel}</span>}
      {topLabel && category && (
        <span aria-hidden className="shrink-0 text-white/40">
          ·
        </span>
      )}
      {category && (
        <span
          className={`min-w-0 truncate font-semibold ${model.phase === 'ended' ? 'text-white/50' : 'text-temple-muted'}`}
        >
          {category}
        </span>
      )}
    </p>
  );
}

// A <div>, not a <p>: the interactive crown mounts its modal in place.
function HostLine({
  party,
  model,
  onShowToast,
}: {
  party: Party;
  model: PartyPageModel;
  onShowToast?: (message: string) => void;
}) {
  return (
    <div className="mt-2 text-[14px] leading-5 text-temple-purple-light [overflow-wrap:anywhere]">
      <span className="font-medium">by {party.host}</span>
      {party.isVerified && (
        <span className="ml-1 inline-flex align-[-2px]">
          {/* Tappable (toast) unless the crown sits 4px away: the crown's 44px
              target would overlap the seal's, so with a crown it stays static
              and keeps its title tooltip + sr-only label. */}
          <VerifiedMark onShowToast={model.isChampion ? undefined : onShowToast} />
        </span>
      )}
      {model.isChampion && (
        <span className="ml-1 inline-flex align-[-2px]">
          <LastSemesterChampBadge interactive hostName={party.host} />
        </span>
      )}
      {model.hostStatsLine && (
        <span className="whitespace-nowrap pl-1 text-white/70 tabular-nums">· {model.hostStatsLine}</span>
      )}
    </div>
  );
}

function FactsLine({ model }: { model: PartyPageModel }) {
  const when =
    model.phase === 'live' ? (
      <span className="flex shrink-0 items-center gap-1.5 font-semibold text-white">
        <span aria-hidden className="size-1.5 rounded-full bg-temple-purple-light" />
        {model.doorLabel}
      </span>
    ) : (
      <span className={`shrink-0 font-semibold ${model.phase === 'ended' ? 'text-white/70' : 'text-white'}`}>
        {model.doorLabel}
      </span>
    );

  return (
    <div className="mt-1.5 text-[13px] leading-[18px] text-white/70 tabular-nums">
      <p className="flex min-w-0 flex-wrap items-center gap-x-1.5">
        {when}
        {model.priceInline && (
          <>
            <span aria-hidden>·</span>
            <span className="whitespace-nowrap">{model.priceLabel}</span>
          </>
        )}
        {model.walkMinutes !== null && (
          <>
            <span aria-hidden>·</span>
            <span className="whitespace-nowrap" title="Walking time from the Bell Tower">
              {model.walkMinutes} min walk
            </span>
          </>
        )}
      </p>
      {!model.priceInline && (
        <p className="mt-0.5 [overflow-wrap:anywhere]">
          <span className="text-white/50">Cover </span>
          <span className="text-white">{model.priceLabel}</span>
        </p>
      )}
    </div>
  );
}
