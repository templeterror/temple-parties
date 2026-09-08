import { displayDoorTime, getDayName } from './dateHelpers';

import { Party } from '@/lib/types';
import { APP_URL } from '@/lib/constants';

export type ShareMethod = 'share' | 'clipboard';
export type ShareResult = { success: boolean; method: ShareMethod };

/**
 * Caption only — no URL. iOS Messages unfurls `navigator.share({ url })`
 * AND any URL inside `text`, which was pasting the link twice.
 */
export function formatPartyShareCaption(party: Party): string {
  const dayName = getDayName(party.day);
  const lines = [
    `pulling up to ${party.title}! by ${party.host}`,
    `${dayName} @ ${displayDoorTime(party.doorsOpen)}`,
  ];
  if (party.goingCount != null) {
    lines.push(`${party.goingCount}+ going`);
  }
  return lines.join('\n');
}

function partyShareUrl(party: Party, path?: string): string {
  return `${APP_URL}${path ?? `/party/${party.id}`}`;
}

/** Clipboard / fallback: caption + the link once. */
export function formatPartyShareText(party: Party, path?: string): string {
  return `${formatPartyShareCaption(party)}\n\n${partyShareUrl(party, path)}`;
}

/**
 * Copy via execCommand first. iOS Safari and Instagram's WebView often
 * deny `clipboard.writeText` (and the async API also loses the user
 * gesture after `await navigator.share()`). Same order as the login-page
 * in-app escape hatch.
 */
export function copyTextSync(text: string): boolean {
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    el.setSelectionRange(0, text.length);
    const ok = typeof document.execCommand === 'function' && document.execCommand('copy');
    document.body.removeChild(el);
    return !!ok;
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  if (copyTextSync(text)) return true;
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

type WebShareData = { title?: string; text?: string; url: string };

function isAppleTouchDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Payload for the system share sheet. Picked synchronously so the first
 * navigator.share() still counts as the tap — a retry after await loses
 * the user gesture on iOS and Safari copies instead of opening the sheet.
 *
 * iPhone/iPad: title+text+url throws TypeError. title+url opens the
 * native drawer (Messages, Instagram, etc.) and iMessage unfurls the URL.
 */
export function webShareData(party?: Party, path?: string): WebShareData {
  const url = party ? partyShareUrl(party, path) : APP_URL;
  if (!party) return { title: 'Temple Parties', url };
  if (isAppleTouchDevice()) return { title: party.title, url };
  return { title: party.title, text: formatPartyShareCaption(party), url };
}

export type ShareOptions = { path?: string };

/**
 * Native share sheet when the browser has one (iOS / Android / Safari).
 * Desktop Chrome has no sheet — copy the caption + link instead.
 */
export async function shareContent(party?: Party, options?: ShareOptions): Promise<ShareResult> {
  const path = options?.path;
  const url = party ? partyShareUrl(party, path) : APP_URL;

  if (typeof navigator.share === 'function') {
    const data = webShareData(party, path);
    if (!navigator.canShare || navigator.canShare(data)) {
      try {
        await navigator.share(data);
        return { success: true, method: 'share' };
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return { success: false, method: 'share' };
        }
      }
    }
  }

  const ok = await copyText(party ? formatPartyShareText(party, path) : url);
  return { success: ok, method: 'clipboard' };
}

/**
 * Open address in maps for walking directions.
 * Apple Maps on iPhone; Google Maps walking Directions API elsewhere (§8.6).
 */
export function openMapsDirections(address: string): void {
  const encodedAddress = encodeURIComponent(address);
  const isIPhone = /iPhone/i.test(navigator.userAgent);

  const mapsUrl = isIPhone
    ? `https://maps.apple.com/?daddr=${encodedAddress}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=walking`;

  window.open(mapsUrl, '_blank');
}
