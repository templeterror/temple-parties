import {
  copyText,
  copyTextSync,
  formatPartyShareCaption,
  formatPartyShareText,
  shareContent,
  webShareData,
} from '@/utils/shareHelpers';
import type { Party } from '@/lib/types';

const party = {
  id: '790c82f0-7a6b-4edb-ba41-95de642d5abc',
  title: 'Perreo Welcome Back',
  host: 'Latin Heat',
  day: 'saturday',
  doorsOpen: '10 PM',
  goingCount: 5,
} as Party;

describe('formatPartyShareCaption', () => {
  it('does not include the party URL (iMessage would unfurl it a second time)', () => {
    const caption = formatPartyShareCaption(party);
    expect(caption).toBe(
      'pulling up to Perreo Welcome Back! by Latin Heat\nSaturday @ 10 PM\n5+ going',
    );
    expect(caption).not.toMatch(/https?:\/\//);
  });

  it('omits the going line when the count is gated', () => {
    expect(formatPartyShareCaption({ ...party, goingCount: null })).toBe(
      'pulling up to Perreo Welcome Back! by Latin Heat\nSaturday @ 10 PM',
    );
  });

  it('never prints 10:00 PM', () => {
    const caption = formatPartyShareCaption({ ...party, doorsOpen: '10:00 PM' });
    expect(caption).toContain('Saturday @ 10 PM');
    expect(caption).not.toContain('10:00');
  });
});

describe('formatPartyShareText', () => {
  it('appends the party link once for clipboard fallback', () => {
    const text = formatPartyShareText(party);
    expect(text).toContain('https://tuparties.com/party/790c82f0-7a6b-4edb-ba41-95de642d5abc');
    expect(text.match(/https:\/\/tuparties\.com/g)).toHaveLength(1);
  });

  it('uses a demo path when one is passed so shares never hit the live party URL', () => {
    const text = formatPartyShareText(party, '/demo/party/demo-fri-headliner');
    expect(text).toContain('https://tuparties.com/demo/party/demo-fri-headliner');
    expect(text).not.toContain('/party/790c82f0');
  });
});

describe('copyTextSync', () => {
  it('copies via execCommand so Instagram WebView / Safari get a user-gesture copy', () => {
    const exec = jest.fn().mockReturnValue(true);
    document.execCommand = exec;

    expect(copyTextSync('hello')).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
  });
});

describe('copyText', () => {
  it('falls back to clipboard.writeText when execCommand fails', async () => {
    document.execCommand = jest.fn().mockReturnValue(false);
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await expect(copyText('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });
});

describe('webShareData', () => {
  const originalUa = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: originalUa });
  });

  it('includes caption + url on desktop so Android Chrome still gets a body', () => {
    expect(webShareData(party)).toEqual({
      title: 'Perreo Welcome Back',
      text: formatPartyShareCaption(party),
      url: 'https://tuparties.com/party/790c82f0-7a6b-4edb-ba41-95de642d5abc',
    });
  });

  it('drops text on iPhone so Safari opens the native sheet instead of throwing', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    });
    expect(webShareData(party)).toEqual({
      title: 'Perreo Welcome Back',
      url: 'https://tuparties.com/party/790c82f0-7a6b-4edb-ba41-95de642d5abc',
    });
  });
});

describe('shareContent', () => {
  const originalShare = navigator.share;

  afterEach(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: originalShare,
    });
  });

  it('passes caption and url separately so iOS does not paste the link twice', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });

    await shareContent(party);

    expect(share).toHaveBeenCalledWith({
      title: 'Perreo Welcome Back',
      text: formatPartyShareCaption(party),
      url: 'https://tuparties.com/party/790c82f0-7a6b-4edb-ba41-95de642d5abc',
    });
    expect(share.mock.calls[0][0].text).not.toContain('http');
  });

  it('does not copy when the user dismisses the native sheet', async () => {
    const abort = Object.assign(new Error('Share canceled'), { name: 'AbortError' });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: jest.fn().mockRejectedValue(abort),
    });
    document.execCommand = jest.fn().mockReturnValue(true);

    const result = await shareContent(party);

    expect(result).toEqual({ success: false, method: 'share' });
    expect(document.execCommand).not.toHaveBeenCalled();
  });

  it('copies the party text when Web Share is missing', async () => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    document.execCommand = jest.fn().mockReturnValue(true);

    const result = await shareContent(party);

    expect(result).toEqual({ success: true, method: 'clipboard' });
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });
});
