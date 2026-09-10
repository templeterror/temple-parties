import { PartyDay, PARTY_DAYS } from '@/lib/types';

/** Weekday after the 6 AM rollover (0 = Sunday … 6 = Saturday). */
function rolledWeekday(now: Date): number {
  let dayOfWeek = now.getDay();
  if (now.getHours() < 6) {
    dayOfWeek = (dayOfWeek - 1 + 7) % 7;
  }
  return dayOfWeek;
}

/**
 * Calendar date (YYYY-MM-DD) after the 6 AM rollover.
 * Sunday 2 AM still belongs to Saturday.
 */
export function getRolledDateISO(now: Date = new Date()): string {
  const rolled = new Date(now.getTime());
  if (now.getHours() < 6) {
    rolled.setDate(rolled.getDate() - 1);
  }
  return toISODate(rolled);
}

/** Days the host prompt is allowed to run. Not the feed's Thu/Fri/Sat tabs. */
export type PromptCadenceDay = 'wednesday' | 'thursday' | 'friday' | 'saturday';

/**
 * Host-prompt weekday with the same 6 AM rollover as getDefaultDay.
 * Sun–Tue (after rollover) are null — do not reuse getDefaultDay, which
 * maps those mornings onto the Thursday feed tab.
 */
export function getPromptCadenceDay(now: Date = new Date()): PromptCadenceDay | null {
  const dayOfWeek = rolledWeekday(now);
  if (dayOfWeek === 3) return 'wednesday';
  if (dayOfWeek === 4) return 'thursday';
  if (dayOfWeek === 5) return 'friday';
  if (dayOfWeek === 6) return 'saturday';
  return null;
}

/**
 * Get the default day to display based on current day of week.
 * On a party night (Thu/Fri/Sat, with 6 AM rollover) show that night;
 * otherwise show Thursday — the first night of the weekend.
 */
export function getDefaultDay(now: Date = new Date()): PartyDay {
  const dayOfWeek = rolledWeekday(now);

  if (dayOfWeek === 4) return 'thursday';
  if (dayOfWeek === 5) return 'friday';
  if (dayOfWeek === 6) return 'saturday';
  return 'thursday';
}

/**
 * Saturday night window, same 6 AM rollover as getDefaultDay: Saturday 6 AM
 * through Sunday 5:59 AM. Used to time the "throw tonight" host prompt.
 */
export function isSaturdayPartyWindow(now: Date = new Date()): boolean {
  return getDefaultDay(now) === 'saturday';
}

/**
 * Calendar Saturday (YYYY-MM-DD) for the current Saturday party window.
 * Sunday 2 AM still belongs to Saturday night. Null when it isn't Saturday.
 */
export function getSaturdayWindowISO(now: Date = new Date()): string | null {
  if (!isSaturdayPartyWindow(now)) return null;
  return getRolledDateISO(now);
}

const DAY_WEEKDAY: Record<PartyDay, number> = {
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const DAY_WORD: Record<PartyDay, string> = {
  thursday: 'THURSDAY',
  friday: 'FRIDAY',
  saturday: 'SATURDAY',
};

/**
 * Feed section label under the headliner ("ALSO TONIGHT · 5").
 * Uses the same 6 AM rollover as getDefaultDay so a 2 AM Saturday still reads as Friday night.
 */
export function getAlsoTonightLabel(
  selectedDay: PartyDay,
  count: number,
  now: Date = new Date(),
): string {
  const isTonight = DAY_WEEKDAY[selectedDay] === rolledWeekday(now);
  const word = isTonight ? 'TONIGHT' : DAY_WORD[selectedDay];
  return `ALSO ${word} · ${count}`;
}

/**
 * Party-page date line: "2026-10-16" → "FRI OCT 16".
 * Parses the ISO string manually as a LOCAL date — new Date("2026-10-16")
 * would read it as UTC midnight, which shifts to the previous day for
 * everyone west of Greenwich (i.e. all of our users).
 */
export function getPartyDateLabel(dateISO: string): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()];
  const monthName = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][date.getMonth()];
  return `${weekday} ${monthName} ${day}`;
}

/**
 * Get the upcoming weekend's Thursday, Friday, and Saturday dates for display in home page tabs.
 * On Saturday-Monday, shows this weekend. On Tuesday-Friday, shows next weekend.
 */
export function getUpcomingDates(): { thursday: string; friday: string; saturday: string } {
  const friday = getUpcomingFriday();
  const thursday = new Date(friday);
  thursday.setDate(friday.getDate() - 1);
  const saturday = new Date(friday);
  saturday.setDate(friday.getDate() + 1);

  return {
    thursday: `${thursday.getDate()}`,
    friday: `${friday.getDate()}`,
    saturday: `${saturday.getDate()}`
  };
}

/**
 * Get the past/current weekend's Thursday, Friday, and Saturday dates for display in rankings tabs.
 * Fri-Sat: current weekend. Sun-Thu: past weekend.
 */
export function getRankingsDates(): { thursday: string; friday: string; saturday: string } {
  const friday = getRankingsFriday();
  const thursday = new Date(friday);
  thursday.setDate(friday.getDate() - 1);
  const saturday = new Date(friday);
  saturday.setDate(friday.getDate() + 1);

  return {
    thursday: `${thursday.getDate()}`,
    friday: `${friday.getDate()}`,
    saturday: `${saturday.getDate()}`
  };
}

function getUpcomingFriday(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
  let daysToFriday: number;
  if (dayOfWeek === 0) {
    // Sunday -> this Friday (2 days ago)
    daysToFriday = -2;
  } else if (dayOfWeek === 1) {
    // Monday -> this past Friday (3 days ago); rollover happens at Tuesday 00:00
    daysToFriday = -3;
  } else if (dayOfWeek === 6) {
    // Saturday -> this Friday (yesterday)
    daysToFriday = -1;
  } else {
    // Tue-Fri -> next Friday
    daysToFriday = ((5 - dayOfWeek) + 7) % 7 || 7;
  }
  if (dayOfWeek === 5) daysToFriday = 0; // Friday -> today
  const friday = new Date(today);
  friday.setDate(today.getDate() + daysToFriday);
  return friday;
}

function getRankingsFriday(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
  let daysToFriday: number;
  if (dayOfWeek === 5) {
    // Friday -> last Friday
    daysToFriday = -7;
  } else if (dayOfWeek === 6) {
    // Saturday -> yesterday (this Friday)
    daysToFriday = -1;
  } else {
    // Sun-Thu -> past Friday
    // Sunday(0)->-2, Mon(1)->-3, Tue(2)->-4, Wed(3)->-5, Thu(4)->-6
    daysToFriday = -(((dayOfWeek - 5) + 7) % 7);
  }
  const friday = new Date(today);
  friday.setDate(today.getDate() + daysToFriday);
  return friday;
}

/** ISO date string (YYYY-MM-DD) for the upcoming weekend's Friday. */
export function getUpcomingFridayISO(): string {
  return toISODate(getUpcomingFriday());
}

/** ISO date string (YYYY-MM-DD) for the rankings weekend's Friday. */
export function getRankingsFridayISO(): string {
  return toISODate(getRankingsFriday());
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DAY_NAMES: Record<PartyDay, string> = {
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
};

const DAY_SHORT: Record<PartyDay, string> = {
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
};

/** Full day name for share text and empty states. */
export function getDayName(day: PartyDay): string {
  return DAY_NAMES[day];
}

/** Short weekday label (Thu / Fri / Sat). */
export function getDayShort(day: PartyDay): string {
  return DAY_SHORT[day];
}

/**
 * If the default night has no parties, land on the first night that does
 * (Thursday → Friday → Saturday). Same rule the feed and map both use.
 */
export function pickSmartDefaultDay(
  defaultDay: PartyDay,
  counts: Record<PartyDay, number>,
): PartyDay {
  if ((counts[defaultDay] ?? 0) > 0) return defaultDay;
  return PARTY_DAYS.find((d) => (counts[d] ?? 0) > 0) ?? defaultDay;
}

export type DoorTimePeriod = 'AM' | 'PM';

export type DoorTimeParts = {
  hour: number; // 1–12
  minute: number; // 0–59
  period: DoorTimePeriod;
};

/**
 * Door time for display: keep AM/PM, never ":00".
 * "10:00 PM" / "10 PM" → "10 PM"; "10:30 PM" stays "10:30 PM".
 * Unparseable strings pass through.
 */
export function displayDoorTime(doorsOpen: string): string {
  const trimmed = doorsOpen.trim();
  if (!trimmed) return trimmed;
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return trimmed;
  const hour = String(parseInt(match[1], 10));
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3].toUpperCase();
  if (!minutes) return `${hour} ${period}`;
  return `${hour}:${String(minutes).padStart(2, '0')} ${period}`;
}

/** Split a doors_open string into hour / minute / AM|PM. Null if unparseable. */
export function parseDoorTimeParts(doorsOpen: string): DoorTimeParts | null {
  const match = doorsOpen.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  return { hour, minute, period: match[3].toUpperCase() as DoorTimePeriod };
}

/** Canonical doors_open string from picker parts ("10 PM", "10:30 PM"). */
export function formatDoorTimeParts(parts: DoorTimeParts): string {
  return displayDoorTime(
    `${parts.hour}:${String(parts.minute).padStart(2, '0')} ${parts.period}`,
  );
}

/**
 * Parse a doors_open string (e.g., "10 PM", "9:30 PM") and a date string
 * into a Date object.
 */
export function parseDoorsOpen(doorsOpen: string, dateStr: string): Date {
  const datePart = dateStr.split('T')[0];
  const partyDate = new Date(datePart + 'T00:00:00');

  const timeStr = doorsOpen.trim().toUpperCase();
  const match = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);

  if (!match) {
    // Fallback: 10 PM
    partyDate.setHours(22, 0, 0, 0);
    return partyDate;
  }

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3];

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  partyDate.setHours(hours, minutes, 0, 0);
  return partyDate;
}

/**
 * Check if rating is currently active for a party.
 * Active once current time >= doorsOpen time.
 */
export function isRatingActive(doorsOpen: string, dateStr: string): boolean {
  const openTime = parseDoorsOpen(doorsOpen, dateStr);
  return new Date() >= openTime;
}

/** ISO date string for the most recent past Friday (last completed weekend). */
export function getLastWeekendFridayISO(): string {
  return toISODate(getRankingsFriday());
}

/** Get the bounding Friday ISO dates for the current calendar month. */
export function getMonthRange(): { from: string; to: string } {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const monthStart = new Date(year, month, 1);
  const fromFriday = new Date(monthStart);
  while (fromFriday.getDay() !== 5) {
    fromFriday.setDate(fromFriday.getDate() + 1);
  }

  const lastDay = new Date(year, month + 1, 0);
  const toFriday = new Date(lastDay);
  while (toFriday.getDay() !== 5) {
    toFriday.setDate(toFriday.getDate() - 1);
  }

  return { from: toISODate(fromFriday), to: toISODate(toFriday) };
}

/** Get the bounding Friday ISO dates for the current semester. */
export function getSemesterRange(): { from: string; to: string } {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  let semesterStart: Date;
  let semesterEnd: Date;

  if (month <= 4) {
    // Spring: January - May
    semesterStart = new Date(year, 0, 1);
    semesterEnd = new Date(year, 4, 31);
  } else if (month >= 7) {
    // Fall: August - December
    semesterStart = new Date(year, 7, 1);
    semesterEnd = new Date(year, 11, 31);
  } else {
    // Summer: default to spring
    semesterStart = new Date(year, 0, 1);
    semesterEnd = new Date(year, 4, 31);
  }

  // Find first Friday >= semesterStart
  const fromFriday = new Date(semesterStart);
  while (fromFriday.getDay() !== 5) {
    fromFriday.setDate(fromFriday.getDate() + 1);
  }

  // Find last Friday <= semesterEnd
  const toFriday = new Date(semesterEnd);
  while (toFriday.getDay() !== 5) {
    toFriday.setDate(toFriday.getDate() - 1);
  }

  return { from: toISODate(fromFriday), to: toISODate(toFriday) };
}

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SHORT_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/** Format an ISO date string for display, e.g. "Fri Mar 6". */
export function formatPartyDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${SHORT_DAYS[date.getDay()]} ${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** Format an ISO date string as short date, e.g. "13 Feb". */
export function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${d} ${SHORT_MONTHS[m - 1]}`;
}

/**
 * Check if rating period has ended.
 * Locked after Monday 11:59:59 PM of the party weekend.
 * dateStr is the party date (YYYY-MM-DD), Thursday, Friday, or Saturday.
 */
export function isRatingLocked(dateStr: string): boolean {
  const partyDate = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = partyDate.getDay(); // 0=Sun … 6=Sat
  const daysToMonday = (1 - dayOfWeek + 7) % 7;
  const mondayCutoff = new Date(partyDate);
  mondayCutoff.setDate(partyDate.getDate() + daysToMonday);
  mondayCutoff.setHours(23, 59, 59, 999);
  return new Date() > mondayCutoff;
}
