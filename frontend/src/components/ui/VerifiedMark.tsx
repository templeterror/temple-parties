/**
 * VerifiedMark — the verified seal that sits after a host name.
 *
 * One inline SVG: a 12-scallop seal in the secondary light purple with a
 * near-black check, drawn in a 24-unit box so it stays crisp at any size.
 * (v1 shipped this as two stacked <img>s nudged into place with pixel
 * offsets — the check drifted off-centre at small sizes, which is why it's
 * a single vector now.)
 *
 * Sizing: 15px by default, matching the 14–15px host line it sits on AND the
 * LastSemesterChampBadge crown that can sit beside it — the two are designed
 * as a pair at the same height, so change both or neither. The mark carries
 * no margin of its own: the host row owns the spacing (`gap-1`).
 *
 * Two modes, picked by whether `onShowToast` is passed:
 *  - with it (party-page HostRow): a real <button> — on phones (no hover) a
 *    tap explains the badge via toast; on desktop the title tooltip does that
 *    job, so the cursor stays default.
 *  - without it (feed cards): a static, non-interactive mark. The card is one
 *    tap target, same as the crown there.
 */

/** The scalloped-seal outline: 12 outward arcs meeting at r≈9.6 in a 24-box. */
const SEAL_PATH =
  'M21.27 14.48A2.57 2.57 0 0 1 18.79 18.79A2.57 2.57 0 0 1 14.48 21.27A2.57 2.57 0 0 1 9.52 21.27' +
  'A2.57 2.57 0 0 1 5.21 18.79A2.57 2.57 0 0 1 2.73 14.48A2.57 2.57 0 0 1 2.73 9.52A2.57 2.57 0 0 1 5.21 5.21' +
  'A2.57 2.57 0 0 1 9.52 2.73A2.57 2.57 0 0 1 14.48 2.73A2.57 2.57 0 0 1 18.79 5.21A2.57 2.57 0 0 1 21.27 9.52' +
  'A2.57 2.57 0 0 1 21.27 14.48Z';

/**
 * The bare seal glyph, for places that need the art without the tap/toast
 * behaviour (e.g. the Leaflet map popup). Colors come from the design tokens
 * so the seal moves with the palette.
 */
export function VerifiedSealIcon({ size = 15, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`block ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <path d={SEAL_PATH} className="fill-temple-purple-light" />
      {/* The check sits a touch low-left of centre on purpose — that's where a
          check's optical centre is, so it reads as centred inside the seal. */}
      <path
        d="M7.4 12.3l3 3 6.2-6.4"
        fill="none"
        className="stroke-black"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function VerifiedMark({
  onShowToast,
  size = 15,
  className = '',
}: {
  onShowToast?: (message: string) => void;
  /** Pixel size of the seal. Default matches the 14–15px host line. */
  size?: number;
  className?: string;
}) {
  const seal = (
    <>
      <VerifiedSealIcon size={size} />
      <span className="sr-only">Verified</span>
    </>
  );

  if (!onShowToast) {
    return (
      <span title="Verified host" className={`shrink-0 inline-flex items-center ${className}`}>
        {seal}
      </span>
    );
  }

  return (
    <button
      type="button"
      title="Verified host"
      aria-label="Verified host"
      onClick={() => onShowToast('Verified host')}
      className={`shrink-0 inline-flex items-center cursor-pointer lg:cursor-default ${className}`}
    >
      {seal}
    </button>
  );
}
