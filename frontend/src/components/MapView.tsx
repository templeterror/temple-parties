'use client';

import dynamic from 'next/dynamic';

import { Party, PartyDay } from '@/lib/types';

interface MapViewProps {
  parties: Party[];
  topPartyIds: Record<PartyDay, string | null>;
  userGoingParties: string[];
  onGoingClick: (partyId: string) => void;
  onNavigateClick: (partyId: string) => void;
  onRateClick: (partyId: string, title: string, host: string, ratingActive: boolean, ratingLocked: boolean) => void;
  thursdayDate: string;
  fridayDate: string;
  saturdayDate: string;
  /** Deep-link target (/map?party=<id>): pan to this pin without opening the drawer. */
  focusPartyId?: string | null;
  /** Fires when the pin drawer opens or closes so the page can hide the tab bar. */
  onSheetOpenChange?: (open: boolean) => void;
  /** Override "now" so the demo clock can freeze pin phase / default day. */
  now?: Date;
}

// Loading placeholder
function MapLoading() {
  return (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
      <div className="text-gray-400">Loading map...</div>
    </div>
  );
}

// Dynamically import the map content with SSR disabled
const MapContent = dynamic(() => import('./MapContent'), {
  ssr: false,
  loading: () => <MapLoading />,
});

export default function MapView(props: MapViewProps) {
  return <MapContent key={props.focusPartyId ?? 'browse'} {...props} />;
}
