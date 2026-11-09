/**
 * AddressGate — decides what shows where an address belongs.
 *
 * Two states (the server is the gate; we don't add a second tap-to-reveal):
 *  1. Logged out → address arrives as null → "Sign in to view address".
 *  2. Logged in → address is present → show the street line immediately.
 */

interface AddressGateProps {
  /** Full address from the API — null means the server soft-gated it. */
  address: string | null;
  /** Unused: kept so feed cards can keep passing the old reveal flag. */
  isRevealed?: boolean;
  animateReveal?: boolean;
  onViewAddress: () => void;
  /** street = first line only (cards) · full = the whole thing (party page). */
  display?: 'street' | 'full';
}

export default function AddressGate({
  address,
  onViewAddress,
  display = 'street',
}: AddressGateProps) {
  const streetLine = address ? address.split(',')[0] : null;
  const shown = display === 'street' ? streetLine : address;

  if (!shown) {
    return (
      // relative z-[2]: lifts the button above a card's stretched link (z-1)
      // so the tap reaches it. py/-my grows the hit area to ~44px tall
      // without moving the line (the parent must not clip it).
      <button
        type="button"
        onClick={onViewAddress}
        className="relative z-[2] py-[13px] -my-[13px] underline underline-offset-2 hover:text-white/90 transition-colors"
      >
        Sign in to view address
      </button>
    );
  }

  return <span className="truncate">{shown}</span>;
}
