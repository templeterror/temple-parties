/**
 * SegmentedTabs — a full-width segmented control (WF-B2 day tabs).
 *
 * A dark pill container where the active segment is filled purple and the
 * inactive ones are just muted text. Segments share the width equally
 * (flex-1), so two or three tabs each take an equal slice of the row.
 *
 * Generic on purpose: DayTabs wraps it for the home feed, and future filter
 * rows (e.g. leaderboards) can reuse it without re-styling anything.
 */

interface SegmentedTabsProps {
  items: { key: string; label: string }[];
  activeKey: string;
  onChange: (key: string) => void;
}

export default function SegmentedTabs({ items, activeKey, onChange }: SegmentedTabsProps) {
  return (
    <div className="flex gap-1 bg-temple-surface p-1 rounded-[12px]">
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            aria-pressed={active}
            className={`flex-1 min-h-11 py-2.5 rounded-[9px] font-montserrat font-bold text-[13px] uppercase transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
              active ? 'bg-temple-purple text-white' : 'text-temple-muted hover:text-white/80'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
