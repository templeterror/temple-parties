/**
 * StatTile — the map PartySheet's fact tile (born on the WF-D party page): a big value over a tiny tracked label
 * ("$5 / COVER", "67 / GOING", "$15+ / TICKETS").
 *
 * Tiles sit in a row and share the width equally (flex-1 comes from the
 * parent's flex layout + w-full here). For soft-gated viewers (logged out,
 * where the server nulls the counts) the caller passes value="—" — the tile
 * itself never decides what it's allowed to show.
 */

export default function StatTile({
  value,
  label,
  className = '',
}: {
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`flex-1 min-w-0 flex flex-col items-center gap-[3px] py-3 rounded-[12px] bg-temple-surface ${className}`}
    >
      <p className="font-montserrat font-bold text-[16px] text-white uppercase tabular-nums">{value}</p>
      <p className="font-montserrat font-bold text-[9px] tracking-[0.9px] uppercase text-temple-muted">
        {label}
      </p>
    </div>
  );
}
