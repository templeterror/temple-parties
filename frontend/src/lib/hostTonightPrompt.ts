/**
 * Host prompt — when it shows, where the CTA goes.
 *
 * Hosts/admins: once per rolled day, Wednesday–Saturday.
 * Everyone else: once on Friday (Fri 6 AM → Sat 5:59 AM).
 * Same 6 AM rollover as the feed. Approved hosts / admins land on /create;
 * everyone else on /become-host.
 */

import {
  HOST_TONIGHT_LOOKING_STORAGE_KEY,
  HOST_TONIGHT_PROMPT_SESSION_KEY,
  HOST_TONIGHT_PROMPT_STORAGE_KEY,
} from '@/lib/constants';
import { getPromptCadenceDay, getRolledDateISO, toISODate } from '@/utils/dateHelpers';

export const HOST_TONIGHT_PROMPT_PATHS = new Set(['/']);

export type HostTonightHref = '/create' | '/become-host';

export function canPostParty(
  user: { isHost?: boolean; isAdmin?: boolean } | null | undefined,
): boolean {
  return !!(user?.isHost || user?.isAdmin);
}

export function hostTonightHref(
  user: { isHost?: boolean; isAdmin?: boolean } | null | undefined,
): HostTonightHref {
  return canPostParty(user) ? '/create' : '/become-host';
}

export const HOST_TONIGHT_CTA = 'Post a party';

export const LOOKING_COUNT_MIN = 150;
export const LOOKING_COUNT_MAX = 350;

export function hostTonightBody(count: number): string {
  return `${count} students are looking now, put it on the feed!`;
}

type LookingStore = {
  /** Count locked to a consume-slot so it does not flicker. */
  byWindow: Record<string, number>;
  /** Remaining unused values; reshuffled when empty. */
  deck: number[];
  last: number | null;
};

function lookingRange(): number[] {
  const nums: number[] = [];
  for (let n = LOOKING_COUNT_MIN; n <= LOOKING_COUNT_MAX; n++) nums.push(n);
  return nums;
}

/** Fisher–Yates. `random` is injectable so tests can pin the shuffle. */
export function shuffleInPlace<T>(arr: T[], random: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function freshDeck(random: () => number, exclude: number | null): number[] {
  const nums = lookingRange().filter((n) => n !== exclude);
  return shuffleInPlace(nums, random);
}

export function readLookingStore(): LookingStore {
  if (typeof window === 'undefined') {
    return { byWindow: {}, deck: [], last: null };
  }
  try {
    const stored = localStorage.getItem(HOST_TONIGHT_LOOKING_STORAGE_KEY);
    if (!stored) return { byWindow: {}, deck: [], last: null };
    const parsed = JSON.parse(stored) as Partial<LookingStore>;
    return {
      byWindow: parsed.byWindow && typeof parsed.byWindow === 'object' ? parsed.byWindow : {},
      deck: Array.isArray(parsed.deck) ? parsed.deck.filter((n) => Number.isInteger(n)) : [],
      last: typeof parsed.last === 'number' ? parsed.last : null,
    };
  } catch {
    return { byWindow: {}, deck: [], last: null };
  }
}

function writeLookingStore(store: LookingStore): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HOST_TONIGHT_LOOKING_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Private mode can throw; the next visit just draws again.
  }
}

/**
 * One integer per consume slot. Draws without replacement from 150–350
 * so consecutive days/weeks do not keep showing the same count.
 */
export function lookingCountForWindow(
  storageKey: string,
  random: () => number = Math.random,
): number {
  const store = readLookingStore();
  const locked = store.byWindow[storageKey];
  if (typeof locked === 'number' && locked >= LOOKING_COUNT_MIN && locked <= LOOKING_COUNT_MAX) {
    return locked;
  }

  if (store.deck.length === 0) {
    store.deck = freshDeck(random, store.last);
  }
  const count = store.deck.pop();
  const drawn =
    typeof count === 'number' ? count : LOOKING_COUNT_MIN + Math.floor(random() * (LOOKING_COUNT_MAX - LOOKING_COUNT_MIN + 1));
  store.byWindow[storageKey] = drawn;
  store.last = drawn;
  writeLookingStore(store);
  return drawn;
}

export function isHostTonightForceParam(search: string): boolean {
  return new URLSearchParams(search).get('host_prompt') === '1';
}

export type HostTonightCadence = 'host_daily' | 'regular_friday';

export function hostTonightCadence(isHost: boolean): HostTonightCadence {
  return isHost ? 'host_daily' : 'regular_friday';
}

/**
 * Consume-slot key. Hosts: one per rolled calendar day. Regulars: one per Friday.
 * `userId` keeps two accounts on the same phone from sharing the counter.
 */
export function hostTonightStorageKey({
  now = new Date(),
  force = false,
  isHost = false,
  userId = null,
}: {
  now?: Date;
  force?: boolean;
  isHost?: boolean;
  userId?: string | null;
} = {}): string | null {
  const id = userId || 'anon';
  if (force) return `force:${id}:${toISODate(now)}`;

  const day = getPromptCadenceDay(now);
  if (!day) return null;

  const rolled = getRolledDateISO(now);
  if (isHost) return `h:${id}:${rolled}`;
  if (day === 'friday') return `r:${id}:${rolled}`;
  return null;
}

export function shouldShowHostTonightPrompt({
  pathname,
  now = new Date(),
  force = false,
  isHost = false,
  userId = null,
  consumedKeys,
}: {
  pathname: string;
  now?: Date;
  force?: boolean;
  isHost?: boolean;
  userId?: string | null;
  consumedKeys: Record<string, boolean>;
}): { show: true; storageKey: string } | { show: false; storageKey: null } {
  if (!HOST_TONIGHT_PROMPT_PATHS.has(pathname)) {
    return { show: false, storageKey: null };
  }
  const storageKey = hostTonightStorageKey({ now, force, isHost, userId });
  if (!storageKey) return { show: false, storageKey: null };
  if (consumedKeys[storageKey] && !force) {
    return { show: false, storageKey: null };
  }
  return { show: true, storageKey };
}

export function readHostTonightConsumed(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(HOST_TONIGHT_PROMPT_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function markHostTonightConsumed(storageKey: string): void {
  if (typeof window === 'undefined') return;
  const current = readHostTonightConsumed();
  current[storageKey] = true;
  localStorage.setItem(HOST_TONIGHT_PROMPT_STORAGE_KEY, JSON.stringify(current));
}

export function readHostTonightRevealed(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(HOST_TONIGHT_PROMPT_SESSION_KEY);
  } catch {
    return null;
  }
}

export function markHostTonightRevealed(storageKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(HOST_TONIGHT_PROMPT_SESSION_KEY, storageKey);
  } catch {
    // Private mode can throw; the delay just runs again next visit.
  }
}
