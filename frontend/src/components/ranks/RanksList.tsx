/**
 * RanksList / RanksUnrankedGroup — the two lists under the podium.
 *
 *   <RanksList aria-label="Ranks 4 to 12">
 *     <RanksListItem><RanksPartyRow … /></RanksListItem>
 *   </RanksList>
 *
 *   <RanksUnrankedGroup title="Not enough votes yet" note="Needs 5 votes to rank.">
 *     <RanksListItem><RanksPartyRow rank={null} … /></RanksListItem>
 *   </RanksUnrankedGroup>
 *
 * `RanksList` is an <ol> (the order IS the content); the unranked group is
 * a labelled <section> holding a <ul> (no order to speak of), introduced by
 * a heading that explains why these entries have no rank — instead of
 * dimming them mid-list (ranks-audit.md). Items are split by a solid
 * hairline in `temple-surface-2`, half a pixel on retina (`.ranks__divided`
 * in globals.css).
 */

import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';

export const RanksList = forwardRef<HTMLOListElement, ComponentPropsWithoutRef<'ol'>>(function RanksList(
  { className = '', ...props },
  ref,
) {
  return <ol ref={ref} {...props} className={`mt-6 ${className}`} />;
});

export const RanksListItem = forwardRef<HTMLLIElement, ComponentPropsWithoutRef<'li'>>(function RanksListItem(
  { className = '', ...props },
  ref,
) {
  return <li ref={ref} {...props} className={`ranks__divided border-temple-surface-2 ${className}`} />;
});

interface RanksUnrankedGroupProps {
  /** "Not enough votes yet" / "Not ranked yet". */
  title: string;
  /** The rule, one line: "Needs 5 votes to rank." */
  note: string;
  children: ReactNode;
}

export function RanksUnrankedGroup({ title, note, children }: RanksUnrankedGroupProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="mt-10">
      <h2 id={headingId} className="text-[15px] font-bold leading-5">
        {title}
      </h2>
      <p className="mt-0.5 text-[13px] leading-[18px] text-temple-muted">{note}</p>
      <ul className="mt-2">{children}</ul>
    </section>
  );
}
