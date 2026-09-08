import { DEMO_SNAPSHOT } from '@/data/demoSnapshot';

/**
 * Resolves the frozen demo weekend. Snapshot is local — no network.
 */
export function useDemoWeekend(): string {
  return DEMO_SNAPSHOT.weekendOf;
}
