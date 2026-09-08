/**
 * ratingHelpers — turns the rating data the API gives us (a like PERCENTAGE
 * plus a total COUNT) into the up/down counts the redesign displays (↑ 78 ↓ 15).
 *
 * Why derive instead of only trusting the server's likeCount/dislikeCount
 * fields: after you rate a party we update the percentage/count optimistically
 * (adjusting the numbers on screen before the server confirms — so the UI
 * feels instant). Deriving from those live values keeps the arrows moving in
 * sync with your tap; the server fields are static until the next fetch.
 * The math is identical to the backend's own derivation, so both paths agree.
 */

export interface VoteCounts {
  likeCount: number;
  dislikeCount: number;
}

/**
 * likePercentage 84 + ratingCount 93 → { likeCount: 78, dislikeCount: 15 }.
 * Returns null when the caller is soft-gated (server sent null counts).
 */
export function voteCounts(
  likePercentage: number | null | undefined,
  ratingCount: number | null | undefined,
): VoteCounts | null {
  if (likePercentage === null || likePercentage === undefined) return null;
  if (ratingCount === null || ratingCount === undefined) return null;
  if (ratingCount <= 0) return { likeCount: 0, dislikeCount: 0 };
  const likeCount = Math.max(0, Math.min(ratingCount, Math.round((likePercentage / 100) * ratingCount)));
  return { likeCount, dislikeCount: ratingCount - likeCount };
}

/**
 * Apply a 0/1 vote onto a like-percentage + count (demo sandbox, and any
 * local overlay). Same-thumb is a no-op; switching moves the vote; a first
 * vote bumps the total.
 */
export function applyUserRating(
  likePercentage: number,
  ratingCount: number,
  previous: number | null | undefined,
  next: number,
): { likePercentage: number; ratingCount: number } {
  if (next !== 0 && next !== 1) return { likePercentage, ratingCount };
  if (previous === next) return { likePercentage, ratingCount };

  const derived = voteCounts(likePercentage, ratingCount) ?? { likeCount: 0, dislikeCount: 0 };
  let likeCount = derived.likeCount;
  let total = ratingCount;

  if (previous == null) {
    total += 1;
    if (next === 1) likeCount += 1;
  } else if (previous === 1) {
    likeCount = Math.max(0, likeCount - 1);
  } else {
    likeCount += 1;
  }

  const pct = total <= 0 ? 0 : Math.round((likeCount / total) * 100);
  return { likePercentage: pct, ratingCount: total };
}
