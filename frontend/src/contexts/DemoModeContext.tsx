'use client';

import { createContext, useContext } from 'react';
import { partyHref } from '@/lib/authHelpers';

const DemoModeContext = createContext(false);

/** True only under `/demo/*`. Cards/ranks/map read this for path containment. */
export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  return <DemoModeContext.Provider value={true}>{children}</DemoModeContext.Provider>;
}

export function useDemoMode(): boolean {
  return useContext(DemoModeContext);
}

export function usePartyHref(id: string): string {
  return partyHref(id, useDemoMode());
}
