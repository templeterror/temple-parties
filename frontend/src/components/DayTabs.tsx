'use client';

/**
 * DayTabs — Thursday / Friday / Saturday switcher at the top of the feed.
 *
 * A thin domain wrapper: it knows the weekend nights and hands the look
 * to SegmentedTabs so the day switcher matches other segmented controls.
 * Mobile padding is tight (slim top, 2026-11-07); the segments stay 44px.
 */

import SegmentedTabs from '@/components/ui/SegmentedTabs';
import type { PartyDay } from '@/lib/types';

interface DayTabsProps {
  selectedDay: PartyDay;
  onDayChange: (day: PartyDay) => void;
  /** Day-of-month strings from the server's weekend envelope ("21", "22"). */
  thursdayDate: string;
  fridayDate: string;
  saturdayDate: string;
}

export default function DayTabs({
  selectedDay,
  onDayChange,
  thursdayDate,
  fridayDate,
  saturdayDate,
}: DayTabsProps) {
  return (
    <div className="max-w-xl mx-auto px-4 pt-1 pb-2 lg:max-w-3xl lg:px-8 lg:pt-3 lg:pb-3">
      <SegmentedTabs
        items={[
          { key: 'thursday', label: `THU ${thursdayDate}` },
          { key: 'friday', label: `FRI ${fridayDate}` },
          { key: 'saturday', label: `SAT ${saturdayDate}` },
        ]}
        activeKey={selectedDay}
        onChange={(key) => onDayChange(key as PartyDay)}
      />
    </div>
  );
}
