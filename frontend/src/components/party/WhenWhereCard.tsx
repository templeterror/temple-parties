/**
 * WhenWhereCard — the party's logistics in one block: date, time range, and
 * address stacked top to bottom (owner call: these belong together — you
 * decide "can I make this?" with all three at once).
 *
 * The address row carries one small action: a map button that jumps to the
 * Map tab focused on this party's pin — spatial context without embedding
 * a map here. Directions still live in the sticky action bar.
 *
 * The address row is the soft-gated part: logged-out viewers see a
 * "Log in to view address" row instead (date and time stay public — the
 * address is the carrot that earns the signup).
 */

import IconButton from '@/components/ui/IconButton';
import { displayDoorTime } from '@/utils/dateHelpers';

/** Same folded-map glyph the bottom nav uses — one map language app-wide. */
function MapGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-[18px]" aria-hidden>
      <path d="M9 18.5 3 21V6l6-2.5M9 18.5 15 21M9 18.5V3.5M15 21l6-2.5V4l-6 2.5M15 21V6.5M15 6.5 9 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface WhenWhereCardProps {
  /** Pre-formatted date line, e.g. "FRI OCT 21". */
  dateLabel: string;
  doorsOpen: string;
  doorsClose?: string | null;
  /** null = server soft-gated it (viewer is logged out). */
  address: string | null;
  /** Fired by the log-in row when the viewer is logged out. */
  onUnlock: () => void;
  /** Opens the Map tab focused on this party. */
  onOpenMap: () => void;
}

export default function WhenWhereCard({
  dateLabel,
  doorsOpen,
  doorsClose,
  address,
  onUnlock,
  onOpenMap,
}: WhenWhereCardProps) {
  return (
    <div className="w-full bg-temple-surface rounded-[14px] divide-y divide-white/5">
      {/* When: date + door hours. */}
      <p className="px-3.5 py-3 font-montserrat font-medium text-[13px] text-white/70">
        {dateLabel} · {displayDoorTime(doorsOpen)}
        {doorsClose && ` — ${displayDoorTime(doorsClose)}`}
      </p>

      {/* Where: the address — or the log-in nudge where it would be. */}
      {address ? (
        <div className="flex items-center justify-between gap-3 pl-3.5 pr-2.5 py-2.5">
          <p className="min-w-0 font-montserrat font-bold text-[13.5px] text-white truncate">
            {address.split(',')[0]}
          </p>
          <IconButton label="See on map" title="See this party on the map" onClick={onOpenMap} tone="outline" size="md">
            <MapGlyph />
          </IconButton>
        </div>
      ) : (
        <button
          type="button"
          onClick={onUnlock}
          className="w-full px-3.5 py-3 text-left font-montserrat text-[13px] text-white/70 underline underline-offset-2 hover:text-white transition-colors"
        >
          Log in to view address
        </button>
      )}
    </div>
  );
}
