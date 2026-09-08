'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import MapView from '@/components/MapView';
import Toast from '@/components/Toast';
import AppShell from '@/components/AppShell';
import DemoBanner from '@/components/DemoBanner';
import useToast from '@/hooks/useToast';
import { useDemoSession } from '@/contexts/DemoSessionContext';
import { trackEvent } from '@/utils/analytics';

export default function DemoMapPage() {
  const pathname = usePathname();
  const [focusPartyId, setFocusPartyId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const {
    weekendOf,
    thursdayDate,
    fridayDate,
    saturdayDate,
    demoNow,
    parties,
    goingParties,
    isGoing,
    toggleGoing,
    ensureGoing,
    topPartyIds,
  } = useDemoSession();

  const toast = useToast();

  useEffect(() => {
    setFocusPartyId(new URLSearchParams(window.location.search).get('party'));
    setSheetOpen(false);
  }, [pathname]);

  const handleGoingClick = useCallback(
    (partyId: string) => {
      const wasGoing = isGoing(partyId);
      toggleGoing(partyId);
      trackEvent('going_toggled', {
        partyId,
        action: wasGoing ? 'unmarked' : 'marked',
        demo: true,
        source: 'map',
      });
    },
    [toggleGoing, isGoing],
  );

  const handleNavigateClick = useCallback(
    (partyId: string) => {
      ensureGoing(partyId);
      trackEvent('navigate_clicked', { partyId, demo: true, source: 'map' });
    },
    [ensureGoing],
  );

  return (
    <AppShell mapMode hideBottomNav={sheetOpen}>
      <div className="h-screen lg:h-[calc(100vh-4rem)] flex flex-col">
        <Header title="Party Map" />
        <DemoBanner weekendOf={weekendOf} />
        <div className={`flex-1 lg:pb-0 ${sheetOpen ? '' : 'pb-20'}`}>
          <MapView
            parties={parties}
            topPartyIds={topPartyIds}
            userGoingParties={goingParties}
            onGoingClick={handleGoingClick}
            onNavigateClick={handleNavigateClick}
            onRateClick={() => undefined}
            thursdayDate={thursdayDate}
            fridayDate={fridayDate}
            saturdayDate={saturdayDate}
            focusPartyId={focusPartyId}
            onSheetOpenChange={setSheetOpen}
            now={demoNow}
          />
        </div>
      </div>

      <Toast message={toast.message} isVisible={toast.isVisible} onClose={toast.hide} />
    </AppShell>
  );
}
