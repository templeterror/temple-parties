'use client';

/**
 * HomeReselect — "tap Home while on Home" as a tiny event, scoped to one
 * AppShell. The dock (BottomNav) emits it; PartyDeck listens and jumps back
 * to #1. A stable emitter rather than a counter in state, so a tap never
 * re-renders the page — only listeners run.
 *
 * No provider (tests that render PartyDeck alone): emit is a no-op and
 * listeners never fire.
 */

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type Listener = () => void;

interface HomeReselect {
  emit: () => void;
  subscribe: (listener: Listener) => () => void;
}

function createHomeReselect(): HomeReselect {
  const listeners = new Set<Listener>();
  return {
    emit: () => listeners.forEach((listener) => listener()),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const HomeReselectContext = createContext<HomeReselect | null>(null);

export function HomeReselectProvider({ children }: { children: ReactNode }) {
  const [value] = useState(createHomeReselect);
  return <HomeReselectContext.Provider value={value}>{children}</HomeReselectContext.Provider>;
}

const noop = () => {};

/** The dock's side: call it when Home is tapped on Home. */
export function useEmitHomeReselect(): () => void {
  return useContext(HomeReselectContext)?.emit ?? noop;
}

/** The page's side: runs the latest `handler` on every Home-on-Home tap. */
export function useOnHomeReselect(handler: () => void): void {
  const ctx = useContext(HomeReselectContext);
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe(() => handlerRef.current());
  }, [ctx]);
}
