import { PARTY_DAYS, type HostRanking, type Party, type PartyRanking } from '@/lib/types';

/**
 * Frozen recruiter sandbox. Titles, hosts, times, and streets come from the
 * real flyers in /public/demo/posters — remapped onto one April 2026
 * Thursday–Saturday so the demo weekend is full. Counts are invented.
 * Never production UUIDs.
 *
 * Clock is pinned to this Friday night so day tabs, "ALSO TONIGHT", and
 * map pin phase feel live instead of historically locked.
 */
export const DEMO_SNAPSHOT = {
  weekendOf: '2026-04-10',
  thursdayDate: '2026-04-09',
  fridayDate: '2026-04-10',
  saturdayDate: '2026-04-11',
  /** Friday 11:30pm Eastern — doors are open, ratings are open. */
  demoNow: '2026-04-10T23:30:00-04:00',
} as const;

function party(p: Party): Party {
  return {
    status: 'approved',
    ratingOpen: true,
    ratingLocked: false,
    ...p,
  };
}

const PI_LAM: NonNullable<Party['hostStats']> = {
  displayName: 'PILAM',
  partiesHosted: 12,
  avgLikePercentage: 88,
  logoUrl: null,
};

const LATIN_HEAT: NonNullable<Party['hostStats']> = {
  displayName: 'Latin Heat',
  partiesHosted: 16,
  avgLikePercentage: 92,
  logoUrl: null,
};

const ALPHA_SIG: NonNullable<Party['hostStats']> = {
  displayName: 'Alpha Sigma Phi',
  partiesHosted: 7,
  avgLikePercentage: 86,
  logoUrl: null,
};

const AEPI: NonNullable<Party['hostStats']> = {
  displayName: 'AEPI',
  partiesHosted: 6,
  avgLikePercentage: 84,
  logoUrl: null,
};

const PI_KAPP: NonNullable<Party['hostStats']> = {
  displayName: 'PIKE',
  partiesHosted: 5,
  avgLikePercentage: 81,
  logoUrl: null,
};

export const DEMO_PARTIES: Party[] = [
  // ── Thursday (flyers that were Fri/Sat, parked here so the demo has a night) ──
  party({
    id: 'demo-thu-first-day-out',
    title: 'FIRST DAY OUT',
    host: 'The Living Legends',
    pinLabel: 'LL',
    category: 'Frat Party',
    day: 'thursday',
    date: DEMO_SNAPSHOT.thursdayDate,
    doorsOpen: '10 PM',
    address: 'TLO, 1700 N Broad St, Philadelphia, PA 19121',
    latitude: 39.97857,
    longitude: -75.1579,
    goingCount: 64,
    likePercentage: 84,
    ratingCount: 22,
    isVerified: false,
    posterImage: '/demo/posters/first-day-out.jpg',
    description: 'The Living Legends present First Day Out — welcome to the Greekdom party. At TLO.',
  }),
  party({
    id: 'demo-thu-miami-vice',
    title: 'MIAMI VICE',
    host: 'PIKE',
    pinLabel: 'PIKE',
    category: 'Frat Party',
    day: 'thursday',
    date: DEMO_SNAPSHOT.thursdayDate,
    doorsOpen: '11 PM',
    address: '1840 N 16th St, Philadelphia, PA 19121',
    latitude: 39.98168,
    longitude: -75.1608,
    goingCount: 48,
    likePercentage: 80,
    ratingCount: 16,
    isVerified: true,
    hostStats: PI_KAPP,
    posterImage: '/demo/posters/pikapp-vice.jpg',
    description: 'Pi Kapp Miami Vice. Doors at 11. 1840 N 16th St.',
  }),
  party({
    id: 'demo-thu-rugby',
    title: 'THE RUGBY HOUSE',
    host: 'The Rugby House',
    pinLabel: 'Rugby',
    category: 'House Party',
    day: 'thursday',
    date: DEMO_SNAPSHOT.thursdayDate,
    doorsOpen: '10 PM',
    address: '1844 N 16th St, Philadelphia, PA 19121',
    latitude: 39.98177,
    longitude: -75.16073,
    goingCount: 71,
    likePercentage: 82,
    ratingCount: 19,
    isVerified: false,
    posterImage: '/demo/posters/rugby-house.jpg',
    description: 'The Rugby House. RSVP at tuparties.com or pull up.',
  }),
  party({
    id: 'demo-thu-white-lies',
    title: 'WHITE LIES',
    host: 'PILAM',
    pinLabel: 'PILAM',
    category: 'Frat Party',
    day: 'thursday',
    date: DEMO_SNAPSHOT.thursdayDate,
    doorsOpen: '11 PM',
    address: '1438 N Broad St, Philadelphia, PA 19121',
    latitude: 39.97579,
    longitude: -75.15907,
    goingCount: 39,
    likePercentage: 77,
    ratingCount: 14,
    isVerified: true,
    hostStats: PI_LAM,
    posterImage: '/demo/posters/pilam-white-lies.jpg',
    description: 'Pi Lam White Lies. Doors at 11. RSVP on tuparties.com.',
  }),
  party({
    id: 'demo-thu-dungeon',
    title: 'THE DUNGEON',
    host: 'The Dungeon',
    pinLabel: 'DG',
    category: 'House Party',
    day: 'thursday',
    date: DEMO_SNAPSHOT.thursdayDate,
    doorsOpen: '11 PM',
    address: '1700 N 17th St, Philadelphia, PA 19121',
    latitude: 39.97967,
    longitude: -75.16285,
    goingCount: 22,
    likePercentage: 73,
    ratingCount: 8,
    isVerified: false,
    posterImage: '/demo/posters/dungeon.jpg',
    description: 'The Dungeon is throwing. Follow @isthedungeonthrowing for the drop.',
  }),

  // ── Friday ──
  party({
    id: 'demo-fri-headliner',
    title: 'FREAKNIK',
    host: 'Ego Hall',
    pinLabel: 'EGO',
    category: 'Other',
    day: 'friday',
    date: DEMO_SNAPSHOT.fridayDate,
    doorsOpen: '10 PM',
    address: '1535 N Carlisle St, Philadelphia, PA 19121',
    latitude: 39.9771,
    longitude: -75.15908,
    goingCount: 186,
    likePercentage: 91,
    ratingCount: 64,
    isVerified: true,
    isHeadliner: true,
    posterImage: '/demo/posters/freaknik.jpg',
    description: 'Freaknik at Eco Hall. DJ Rook x DJ Krudd. Doors 10 PM. Discounted entry with Y2K attire.',
    promoLabel: 'Y2K ATTIRE DISCOUNT',
    promoHint: 'Discounted entry in Y2K. Show the flyer at the door.',
  }),
  party({
    id: 'demo-fri-wig',
    title: 'WIG PARTY',
    host: 'PILAM',
    pinLabel: 'PILAM',
    category: 'Frat Party',
    day: 'friday',
    date: DEMO_SNAPSHOT.fridayDate,
    doorsOpen: '11 PM',
    address: '1438 N Broad St, Philadelphia, PA 19121',
    latitude: 39.97579,
    longitude: -75.15907,
    goingCount: 94,
    likePercentage: 86,
    ratingCount: 31,
    isVerified: true,
    hostStats: PI_LAM,
    posterImage: '/demo/posters/pilam-wig.jpg',
    description: 'Pi Lam Wig Party. April 10th, 11 PM. 1438 North Broad St.',
  }),
  party({
    id: 'demo-fri-latin-heat',
    title: 'LATIN HEAT PERREO',
    host: 'Latin Heat',
    pinLabel: 'Latin',
    category: 'House Party',
    day: 'friday',
    date: DEMO_SNAPSHOT.fridayDate,
    doorsOpen: '10 PM',
    doorsClose: '3 AM',
    address: '1600 N 15th St, Philadelphia, PA 19121',
    latitude: 39.97762,
    longitude: -75.15994,
    goingCount: 142,
    likePercentage: 90,
    ratingCount: 48,
    isVerified: true,
    hostStats: LATIN_HEAT,
    posterImage: '/demo/posters/latin-heat.jpg',
    description: 'Latin Heat Perreo. DJ Travis, DJ Guabanicexxx, DJ Chris. Free shots at 12. DM @latinheattemple for tickets.',
    ticketPrice: 'DM @latinheattemple',
    promoLabel: 'FREE SHOTS @ 12',
    promoHint: 'Free shots at midnight. DM @latinheattemple for tickets.',
  }),
  party({
    id: 'demo-fri-yolo-ii',
    title: 'YOLO II',
    host: 'YOLO',
    pinLabel: 'YOLO',
    category: 'House Party',
    day: 'friday',
    date: DEMO_SNAPSHOT.fridayDate,
    doorsOpen: '11 PM',
    address: '2015 N 16th St, Philadelphia, PA 19121',
    latitude: 39.98417,
    longitude: -75.15983,
    goingCount: 88,
    likePercentage: 83,
    ratingCount: 27,
    isVerified: false,
    posterImage: '/demo/posters/yolo-ii.jpg',
    description: 'YOLO II house party. 18+. DJ + drinks. RNB, pop, hip hop, dancehall, afrobeats, reggaeton, latin. No wall hugging.',
    promoLabel: 'GIRLS FREE',
    promoHint: 'Girls free. DJ + drinks. No wall hugging.',
  }),

  // ── Saturday ──
  party({
    id: 'demo-sat-rooftop',
    title: 'ROOFTOP DARTY',
    host: 'Mausoleum Prod',
    pinLabel: 'MP',
    category: 'Darty',
    day: 'saturday',
    date: DEMO_SNAPSHOT.saturdayDate,
    doorsOpen: '3:30 PM',
    address: '1512 W Master St, Philadelphia, PA 19121',
    latitude: 39.97465,
    longitude: -75.16069,
    goingCount: 81,
    likePercentage: 85,
    ratingCount: 24,
    isVerified: false,
    posterImage: '/demo/posters/rooftop-darty.jpg',
    ticketPrice: '$5',
    description: 'Mausoleum Prod rooftop darty. Sounds by DJ Dru and DJ Chris. Juice provided. $5 at the door until inflation.',
  }),
  party({
    id: 'demo-sat-ibiza',
    title: 'IBIZA DARTY',
    host: 'KDR',
    pinLabel: 'KDR',
    category: 'Darty',
    day: 'saturday',
    date: DEMO_SNAPSHOT.saturdayDate,
    doorsOpen: '3 PM',
    address: '1437 N 15th St, Philadelphia, PA 19121',
    latitude: 39.97522,
    longitude: -75.16024,
    goingCount: 97,
    likePercentage: 87,
    ratingCount: 29,
    isVerified: false,
    posterImage: '/demo/posters/ibiza-darty.jpg',
    description: 'Ibiza Darty. Saturday, starts 3 PM. 1437 North 15th Street.',
  }),
  party({
    id: 'demo-sat-headliner',
    title: 'RAVE NIGHT',
    host: 'Alpha Sigma Phi',
    pinLabel: 'ASIG',
    category: 'Frat Party',
    day: 'saturday',
    date: DEMO_SNAPSHOT.saturdayDate,
    doorsOpen: '11 PM',
    doorsClose: '2 AM',
    address: '1629 W Diamond St, Philadelphia, PA 19121',
    latitude: 39.98529,
    longitude: -75.16031,
    goingCount: 154,
    likePercentage: 89,
    ratingCount: 52,
    isVerified: true,
    isHeadliner: true,
    hostStats: ALPHA_SIG,
    posterImage: '/demo/posters/asig-rave.jpg',
    description: 'Alpha Sigma Phi presents Rave Night. 11 PM–2 AM. 1629 W Diamond St.',
  }),
  party({
    id: 'demo-sat-neon',
    title: 'NEON PARTY',
    host: 'AEPI',
    pinLabel: 'AEPI',
    category: 'Frat Party',
    day: 'saturday',
    date: DEMO_SNAPSHOT.saturdayDate,
    doorsOpen: '11 PM',
    doorsClose: '2 AM',
    address: '1900 N 17th St, Philadelphia, PA 19121',
    latitude: 39.98245,
    longitude: -75.16219,
    goingCount: 103,
    likePercentage: 84,
    ratingCount: 33,
    isVerified: true,
    hostStats: AEPI,
    posterImage: '/demo/posters/aepi-neon.jpg',
    description: 'AEPi Neon Party. Music by Red Lens & Xander. 11 PM–2 AM. Last party of the semester.',
  }),
  party({
    id: 'demo-sat-yolo',
    title: 'YOLO HOUSE PARTY',
    host: 'YOLO',
    pinLabel: 'YOLO',
    category: 'House Party',
    day: 'saturday',
    date: DEMO_SNAPSHOT.saturdayDate,
    doorsOpen: '11 PM',
    address: '2015 N 16th St, Philadelphia, PA 19121',
    latitude: 39.98417,
    longitude: -75.15983,
    goingCount: 76,
    likePercentage: 81,
    ratingCount: 21,
    isVerified: false,
    posterImage: '/demo/posters/yolo.jpg',
    description: 'YOLO house party. 18+. Free before 11:30. Girls free. No wall hugging.',
    promoLabel: 'GIRLS FREE',
    promoHint: 'Free entry before 11:30. Girls free all night.',
  }),
  party({
    id: 'demo-sat-coachella',
    title: 'COACHELLA',
    host: 'PILAM',
    pinLabel: 'PILAM',
    category: 'Frat Party',
    day: 'saturday',
    date: DEMO_SNAPSHOT.saturdayDate,
    doorsOpen: '11 PM',
    address: '1438 N Broad St, Philadelphia, PA 19121',
    latitude: 39.97579,
    longitude: -75.15907,
    goingCount: 118,
    likePercentage: 88,
    ratingCount: 41,
    isVerified: true,
    hostStats: PI_LAM,
    posterImage: '/demo/posters/pilam-coachella.jpg',
    description: 'Pi Lam presents a Coachella themed night party. 11 PM. 1438 North Broad Street.',
  }),
];

export const DEMO_HOST_RANKINGS: HostRanking[] = [
  {
    hostCode: 'demo-latin-heat',
    displayName: 'Latin Heat',
    logoUrl: null,
    partiesHosted: 16,
    totalRatingCount: 240,
    totalGoingCount: 2100,
    avgLikePercentage: 92,
    bayesianScore: 0.89,
    finalScore: 0.91,
    isEligible: true,
  },
  {
    hostCode: 'demo-pi-lam',
    displayName: 'PILAM',
    logoUrl: null,
    partiesHosted: 12,
    totalRatingCount: 186,
    totalGoingCount: 1520,
    avgLikePercentage: 88,
    bayesianScore: 0.85,
    finalScore: 0.87,
    isEligible: true,
  },
  {
    hostCode: 'demo-alpha-sig',
    displayName: 'ASIG',
    logoUrl: null,
    partiesHosted: 7,
    totalRatingCount: 110,
    totalGoingCount: 890,
    avgLikePercentage: 86,
    bayesianScore: 0.82,
    finalScore: 0.84,
    isEligible: true,
  },
  {
    hostCode: 'demo-aepi',
    displayName: 'AEPI',
    logoUrl: null,
    partiesHosted: 6,
    totalRatingCount: 94,
    totalGoingCount: 720,
    avgLikePercentage: 84,
    bayesianScore: 0.8,
    finalScore: 0.81,
    isEligible: true,
  },
  {
    hostCode: 'demo-pi-kapp',
    displayName: 'PIKE',
    logoUrl: null,
    partiesHosted: 5,
    totalRatingCount: 72,
    totalGoingCount: 510,
    avgLikePercentage: 81,
    bayesianScore: 0.76,
    finalScore: 0.77,
    isEligible: true,
  },
  {
    hostCode: 'demo-yolo',
    displayName: 'YOLO',
    logoUrl: null,
    partiesHosted: 2,
    totalRatingCount: 48,
    totalGoingCount: 164,
    avgLikePercentage: 82,
    bayesianScore: 0.64,
    finalScore: 0.64,
    isEligible: false,
  },
];

export const DEMO_PARTY_IDS = new Set(DEMO_PARTIES.map((p) => p.id));

export function demoNowDate(): Date {
  return new Date(DEMO_SNAPSHOT.demoNow);
}

/** Day-of-month string for DayTabs ("10") from an ISO date. */
export function demoDayOfMonth(iso: string): string {
  const day = iso.split('-')[2];
  return day ? String(Number(day)) : '';
}

export function findDemoParty(id: string): Party | undefined {
  return DEMO_PARTIES.find((p) => p.id === id);
}

export function toDemoPartyRankings(
  parties: Party[],
  userRatings: Record<string, number>,
): PartyRanking[] {
  return [...parties]
    .map((p) => ({
      id: p.id,
      title: p.title,
      host: p.host,
      category: p.category,
      day: p.day,
      date: p.date,
      doorsOpen: p.doorsOpen,
      posterImage: p.posterImage ?? null,
      likePercentage: p.likePercentage ?? 0,
      ratingCount: p.ratingCount ?? 0,
      goingCount: p.goingCount ?? 0,
      userRating: userRatings[p.id] ?? null,
    }))
    .sort((a, b) => b.likePercentage - a.likePercentage || b.ratingCount - a.ratingCount);
}

export function topPartyIdsByDay(parties: Party[]): Record<(typeof PARTY_DAYS)[number], string | null> {
  const ids = { thursday: null, friday: null, saturday: null } as Record<
    (typeof PARTY_DAYS)[number],
    string | null
  >;
  for (const day of PARTY_DAYS) {
    const ofDay = parties
      .filter((p) => p.day === day)
      .sort((a, b) => (b.goingCount ?? 0) - (a.goingCount ?? 0));
    ids[day] = ofDay[0]?.id ?? null;
  }
  return ids;
}
