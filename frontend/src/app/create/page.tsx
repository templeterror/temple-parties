'use client';

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import AddressAutocomplete from '@/components/ui/AddressAutocomplete';
import DashedCard from '@/components/ui/DashedCard';
import DoorTimePicker from '@/components/ui/DoorTimePicker';
import WeekendCalendarPicker, {
  formatWeekendRange,
  type WeekendOption,
} from '@/components/WeekendCalendarPicker';
import { useAuth } from '@/contexts/AuthContext';
import { partiesApi, hostsApi, adminApi } from '@/services/api';
import type { HostApplication } from '@/lib/types';
import { resizePosterFile } from '@/utils/posterImage';
import { normalizeTicketUrl } from '@/utils/ticketUrl';
import { trackEvent } from '@/utils/analytics';

const DEFAULT_DOORS_OPEN = '10 PM';
const CATEGORIES = ['Frat Party', 'House Party', 'House Show', 'Rooftop Party', 'Other'];

type Step = 'basics' | 'poster' | 'description' | 'ticket' | 'done';

const STEPS: Step[] = ['basics', 'poster', 'description', 'ticket', 'done'];

/**
 * FLOW 8 create-party (Epic 8.3/8.4): multi-step host submission → pending.
 */
export default function CreatePartyPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, needsOnboarding } = useAuth();

  const [step, setStep] = useState<Step>('basics');
  const [title, setTitle] = useState('');
  const [host, setHost] = useState('');
  const [pinLabel, setPinLabel] = useState('');
  const [address, setAddress] = useState('');
  const [doorsOpen, setDoorsOpen] = useState(DEFAULT_DOORS_OPEN);
  const [category, setCategory] = useState(CATEGORIES[1]);
  const [date, setDate] = useState('');
  const [todayIso, setTodayIso] = useState('');
  const [weekends, setWeekends] = useState<WeekendOption[]>([]);
  const [selectedWeekendOf, setSelectedWeekendOf] = useState('');
  const [description, setDescription] = useState('');
  const [ticketPrice, setTicketPrice] = useState('');
  // Raw ticket-link text as typed; cleaned by normalizeTicketUrl on submit.
  // When it survives, the party page grows a BUY TICKETS bar (WF-D2).
  const [ticketLink, setTicketLink] = useState('');
  // Promo lives behind a disclosure so the Tickets step doesn't open as five
  // bare inputs. Code + label travel together (the party page's coupon only
  // renders when BOTH exist — the server enforces the same pairing).
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLabel, setPromoLabel] = useState('');
  const [promoHint, setPromoHint] = useState('');
  const [posterPath, setPosterPath] = useState<string | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [pendingPosterBlob, setPendingPosterBlob] = useState<Blob | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [weekendLoading, setWeekendLoading] = useState(true);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hostPrefillRef = useRef(false);

  const [hostChecking, setHostChecking] = useState(true);
  // The approved application IS the host's org identity: it locks the host
  // name and gates the Frat category (admins have no application — free rein).
  const [hostOrg, setHostOrg] = useState<HostApplication | null>(null);

  // Manual-upload mode (?manual=1, admins only — reached from the admin
  // dashboard): posts through the admin endpoint instead, so the host name
  // is kept exactly as typed (no org stamp) and the party goes live with no
  // approval queue. Read from window instead of useSearchParams to keep this
  // client page out of a Suspense boundary.
  const [manualParam, setManualParam] = useState(false);
  useEffect(() => {
    setManualParam(new URLSearchParams(window.location.search).get('manual') === '1');
  }, []);
  const manualUpload = manualParam && !!user?.isAdmin;

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login?next=/create');
      return;
    }
    if (needsOnboarding) {
      router.replace('/onboarding?next=/create');
    }
  }, [isAuthenticated, isLoading, needsOnboarding, router]);

  useEffect(() => {
    if (!isAuthenticated || needsOnboarding || isLoading) return;
    let cancelled = false;
    void (async () => {
      try {
        const me = await hostsApi.getMe();
        if (cancelled) return;
        if (!me.isHost) {
          router.replace('/become-host');
          return;
        }
        if (me.application?.status === 'approved') {
          setHostOrg(me.application);
        } else if (!user?.isAdmin) {
          // Parties render under the host account's org name, so a legacy
          // is_host flag with no approved application isn't enough to post —
          // there'd be no name to post under. Apply first (admins excepted).
          router.replace('/become-host');
          return;
        }
        setHostChecking(false);
      } catch {
        if (!cancelled) router.replace('/become-host');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, needsOnboarding, isLoading, router, user]);

  useEffect(() => {
    if (hostPrefillRef.current) return;
    // Manual uploads type the host by hand — no prefill at all.
    if (manualUpload) return;
    // Approved hosts post under their org's name — locked, not a suggestion.
    // Deliberately NO other prefill: an admin with no host account types the
    // org they're posting for; a personal username must never be the default
    // (parties belong to host accounts, not people).
    if (hostOrg) {
      hostPrefillRef.current = true;
      setHost(hostOrg.orgName.slice(0, 30));
    }
  }, [hostOrg, manualUpload]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await partiesApi.getCreateOptions();
        if (cancelled) return;
        setTodayIso(data.today);
        setWeekends(data.weekends);
        const first = data.weekends[0];
        if (first) {
          setSelectedWeekendOf(first.weekendOf);
          // Prefer first night that is today or later (Fri/Sat-only once Thursday has passed).
          const firstDay =
            [first.thursdayDate, first.fridayDate, first.saturdayDate].find(
              (d) => d && d >= data.today,
            ) ?? first.saturdayDate;
          setDate((prev) => prev || firstDay);
        }
      } catch {
        if (!cancelled) setError('Could not load weekend dates. Refresh and try again.');
      } finally {
        if (!cancelled) setWeekendLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedWeekend = weekends.find((w) => w.weekendOf === selectedWeekendOf) ?? weekends[0];

  useEffect(() => {
    return () => {
      if (posterPreview?.startsWith('blob:')) URL.revokeObjectURL(posterPreview);
    };
  }, [posterPreview]);

  const validateBasics = (): boolean => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = 'Title is required';
    else if (title.length > 50) next.title = 'Title must be 50 characters or less';
    if (!host.trim()) next.host = 'Host is required';
    else if (host.length > 30) next.host = 'Host must be 30 characters or less';
    if (!pinLabel.trim()) next.pinLabel = 'Pin label is required';
    else if (pinLabel.length > 5) next.pinLabel = 'Pin label must be 5 characters or less';
    if (!address.trim()) next.address = 'Address is required';
    if (!date) next.date = 'Pick Thursday, Friday, or Saturday';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  const goBack = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const onPosterFile = async (file: File | null) => {
    if (!file) return;
    setError('');
    setSubmitting(true);
    try {
      const blob = await resizePosterFile(file);
      if (posterPreview?.startsWith('blob:')) URL.revokeObjectURL(posterPreview);
      setPendingPosterBlob(blob);
      setPosterPreview(URL.createObjectURL(blob));
      setPosterPath(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process image');
    } finally {
      setSubmitting(false);
    }
  };

  const clearPoster = () => {
    if (posterPreview?.startsWith('blob:')) URL.revokeObjectURL(posterPreview);
    setPendingPosterBlob(null);
    setPosterPreview(null);
    setPosterPath(null);
  };

  // `ticketUrl` and `promo` arrive already cleaned/validated by
  // handleTicketSubmit — this function never sees raw input, so the payload
  // can trust them as-is.
  const submitParty = async (
    ticketUrl?: string,
    promo?: { code: string; label: string; hint?: string }
  ) => {
    setSubmitting(true);
    setError('');
    try {
      let path = posterPath;
      if (pendingPosterBlob && !path) {
        const uploaded = await partiesApi.uploadPoster(pendingPosterBlob);
        path = uploaded.path;
        setPosterPath(path);
      }

      // Manual uploads go through the admin endpoint: same payload, but the
      // host name is kept verbatim and the party skips the approval queue.
      const createParty = manualUpload ? adminApi.createParty : partiesApi.createParty;
      await createParty({
        title: title.trim(),
        host: host.trim(),
        pin_label: pinLabel.trim(),
        category,
        date,
        doors_open: doorsOpen,
        address: address.trim(),
        latitude: coords?.lat,
        longitude: coords?.lng,
        description: description.trim() || undefined,
        ticket_price: ticketPrice.trim() || undefined,
        external_ticket_url: ticketUrl,
        promo_code: promo?.code,
        promo_label: promo?.label,
        promo_hint: promo?.hint,
        poster_image: path || undefined,
      });

      trackEvent('party_created', {
        source: manualUpload ? 'admin_manual' : 'host',
        category,
        has_poster: !!path,
        has_description: !!description.trim(),
        has_ticket_price: !!ticketPrice.trim(),
        has_ticket_url: !!ticketUrl,
        has_promo: !!promo,
        day:
          date === selectedWeekend?.thursdayDate
            ? 'thursday'
            : date === selectedWeekend?.saturdayDate
              ? 'saturday'
              : 'friday',
        weekend_of: selectedWeekend?.weekendOf,
      });
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit party');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBasicsContinue = (e: FormEvent) => {
    e.preventDefault();
    if (!validateBasics()) return;
    goNext();
  };

  // Final step's submit: clean the ticket link and check the promo pairing
  // (or stop with field errors), then hand send-ready values to submitParty.
  const handleTicketSubmit = (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};

    const { url, error: linkError } = normalizeTicketUrl(ticketLink);
    if (linkError) nextErrors.ticketLink = linkError;

    // Promo rule (same as the server's): the code and its label travel
    // together — a code nobody can read or a label with nothing to copy
    // would render no coupon at all. Hint alone counts as "started a promo".
    const code = promoCode.trim();
    const label = promoLabel.trim();
    const hint = promoHint.trim();
    if (code || label || hint) {
      if (!code) nextErrors.promoCode = 'Add the code itself — that’s what people copy.';
      else if (code.length < 2) nextErrors.promoCode = 'Codes are 2–24 letters and numbers.';
      if (!label) nextErrors.promoLabel = 'Add the deal line — what the code gets them.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors((p) => ({ ...p, ...nextErrors }));
      return;
    }

    const promo =
      code && label ? { code, label, hint: hint || undefined } : undefined;
    void submitParty(url, promo);
  };

  const stepIndex = STEPS.indexOf(step);
  const progressSteps = STEPS.filter((s) => s !== 'done');

  if (isLoading || !isAuthenticated || needsOnboarding || hostChecking) {
    return (
      <AppShell>
        <div className="flex justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#b24bf3]" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="pb-[var(--dock-clearance)] lg:pb-8 max-w-md mx-auto px-6 pt-10">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <Link href="/profile" className="text-[#b24bf3] text-sm font-montserrat font-semibold">
              Back
            </Link>
            {step !== 'done' && (
              <span className="text-white/40 text-xs font-montserrat">
                Step {Math.min(stepIndex + 1, progressSteps.length)} of {progressSteps.length}
              </span>
            )}
          </div>
          {step !== 'done' && (
            <div className="flex gap-1.5 mb-6">
              {progressSteps.map((s, i) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full ${
                    i <= stepIndex ? 'bg-[#b24bf3]' : 'bg-zinc-800'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {step === 'basics' && (
          <form onSubmit={handleBasicsContinue} className="space-y-4">
            <div>
              <h1 className="text-white text-2xl font-montserrat font-semibold">Create a party</h1>
              <p className="text-white/60 text-sm font-montserrat mt-1">
                Name, location, and time for this weekend.
              </p>
            </div>

            <Field label="Title" required error={errors.title}>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors((p) => ({ ...p, title: '' }));
                }}
                maxLength={50}
                placeholder="e.g., Sigma Chi House Party"
                className={inputClass}
              />
            </Field>

            <Field label="Host" required error={errors.host}>
              {hostOrg && !manualUpload ? (
                <>
                  <input value={host} readOnly disabled className={`${inputClass} opacity-60 cursor-not-allowed`} />
                  <p className="text-temple-muted text-[11px] font-montserrat mt-1.5">
                    Locked to your host account — parties post as {hostOrg.orgName}.
                  </p>
                </>
              ) : (
                <>
                  <input
                    value={host}
                    onChange={(e) => {
                      setHost(e.target.value);
                      if (errors.host) setErrors((p) => ({ ...p, host: '' }));
                    }}
                    maxLength={30}
                    placeholder="e.g., Sigma Chi"
                    className={inputClass}
                  />
                  {manualUpload && (
                    <p className="text-temple-muted text-[11px] font-montserrat mt-1.5">
                      Manual upload — the party posts under exactly this name and goes live immediately.
                    </p>
                  )}
                </>
              )}
            </Field>

            <Field label="Map pin label" required error={errors.pinLabel} hint="Max 5 characters">
              <input
                value={pinLabel}
                onChange={(e) => {
                  setPinLabel(e.target.value);
                  if (errors.pinLabel) setErrors((p) => ({ ...p, pinLabel: '' }));
                }}
                maxLength={5}
                placeholder="e.g., ΣΧ"
                className={inputClass}
              />
            </Field>

            <Field label="Location" required error={errors.address}>
              {/* Shared with the become-host form — street addresses + campus landmarks. */}
              <AddressAutocomplete
                value={address}
                onChange={(v) => {
                  setAddress(v);
                  setCoords(null); // typing invalidates a picked suggestion's lat/lng
                  if (errors.address) setErrors((prev) => ({ ...prev, address: '' }));
                }}
                onSelect={(addr, picked) => {
                  setAddress(addr);
                  setCoords(picked);
                }}
                placeholder="Street address or campus spot…"
                inputClassName={inputClass}
              />
            </Field>

            <Field label="Night" required error={errors.date}>
              {weekendLoading ? (
                <p className="text-white/40 text-sm font-montserrat">Loading calendar…</p>
              ) : (
                <WeekendCalendarPicker
                  weekends={weekends}
                  todayIso={todayIso}
                  value={date}
                  onChange={(iso, weekendOf) => {
                    setDate(iso);
                    setSelectedWeekendOf(weekendOf);
                    if (errors.date) setErrors((p) => ({ ...p, date: '' }));
                  }}
                  error={errors.date}
                />
              )}
            </Field>

            <Field label="Doors open">
              <DoorTimePicker
                value={doorsOpen}
                onChange={setDoorsOpen}
                selectClassName={`${inputClass} flex-1 min-w-0`}
              />
            </Field>

            <Field label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
              >
                {CATEGORIES.filter(
                  (c) => c !== 'Frat Party' || user?.isAdmin || hostOrg?.orgType === 'frat',
                ).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            {error && <p className="text-red-400 text-sm font-montserrat">{error}</p>}
            <PrimaryButton disabled={weekendLoading}>Continue</PrimaryButton>
          </form>
        )}

        {step === 'poster' && (
          <div className="space-y-5">
            <div>
              <h1 className="text-white text-2xl font-montserrat font-semibold">Poster</h1>
              <p className="text-white/60 text-sm font-montserrat mt-1">
                Optional — a flyer helps your listing stand out.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
              className="w-full max-w-[260px] mx-auto aspect-[4/5] rounded-xl border border-dashed border-white/20 bg-temple-surface flex flex-col items-center justify-center overflow-hidden disabled:opacity-60"
            >
              {posterPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={posterPreview} alt="Poster preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white/50 text-sm font-montserrat px-4 text-center">
                  Tap to upload JPEG, PNG, or WebP
                </span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => void onPosterFile(e.target.files?.[0] ?? null)}
            />
            {posterPreview && (
              <button
                type="button"
                onClick={clearPoster}
                className="text-sm font-montserrat text-white/50 underline"
              >
                Remove poster
              </button>
            )}
            {error && <p className="text-red-400 text-sm font-montserrat">{error}</p>}
            <div className="flex gap-3">
              <SecondaryButton onClick={goBack}>Back</SecondaryButton>
              <PrimaryButton onClick={goNext} type="button">
                Continue
              </PrimaryButton>
            </div>
            <button
              type="button"
              onClick={goNext}
              className="w-full text-center text-white/40 text-sm font-montserrat"
            >
              Skip for now
            </button>
          </div>
        )}

        {step === 'description' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              goNext();
            }}
            className="space-y-5"
          >
            <div>
              <h1 className="text-white text-2xl font-montserrat font-semibold">Description</h1>
              <p className="text-white/60 text-sm font-montserrat mt-1">
                Optional — what should people know?
              </p>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              rows={5}
              placeholder="BYOB, dress code, theme…"
              className={`${inputClass} resize-none`}
            />
            <p className="text-white/30 text-xs font-montserrat text-right">
              {description.length}/1000
            </p>
            <div className="flex gap-3">
              <SecondaryButton onClick={goBack}>Back</SecondaryButton>
              <PrimaryButton>Continue</PrimaryButton>
            </div>
            <button
              type="button"
              onClick={goNext}
              className="w-full text-center text-white/40 text-sm font-montserrat"
            >
              Skip for now
            </button>
          </form>
        )}

        {step === 'ticket' && (
          <form onSubmit={handleTicketSubmit} className="space-y-5">
            <div>
              <h1 className="text-white text-2xl font-montserrat font-semibold">Tickets</h1>
              <p className="text-white/60 text-sm font-montserrat mt-1">
                All optional — skip if the door handles it.
              </p>
            </div>

            <Field
              label="Ticket link"
              error={errors.ticketLink}
              hint="Selling online? Paste the page — your listing gets a BUY TICKETS button."
            >
              <input
                value={ticketLink}
                onChange={(e) => {
                  setTicketLink(e.target.value.slice(0, 500));
                  if (errors.ticketLink) setErrors((p) => ({ ...p, ticketLink: '' }));
                }}
                // url inputMode + no autocap/autocorrect: phone keyboards love
                // to "fix" URLs into sentences.
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={500}
                placeholder="posh.vip/e/your-party"
                className={inputClass}
              />
            </Field>

            {/* Free text on purpose (no checkout behind it), but the listing
                only ever shows FREE / $N — utils/coverPrice.ts reads the
                number out of whatever gets typed. The hint says so, so hosts
                don't write prose that then vanishes. */}
            <Field label="Cover" hint="Dollars only — shows as $10. Leave blank for FREE.">
              <input
                value={ticketPrice}
                onChange={(e) => setTicketPrice(e.target.value.slice(0, 50))}
                inputMode="decimal"
                placeholder="e.g., 10"
                className={inputClass}
                maxLength={50}
              />
            </Field>

            {/* Promo code — collapsed until wanted. The dashed border is the
                app's coupon cue, so the disclosure previews exactly what
                partygoers will see on the party page. */}
            {!promoOpen ? (
              <DashedCard onClick={() => setPromoOpen(true)} className="px-4 py-3.5">
                <p className="text-white font-montserrat font-semibold text-sm">
                  ＋ Add a promo code
                </p>
                <p className="text-white/50 text-xs font-montserrat mt-0.5">
                  A code people copy from your listing — $5 off, free cover, your call.
                </p>
              </DashedCard>
            ) : (
              <DashedCard className="px-4 py-4 space-y-4">
                <Field label="Code" error={errors.promoCode} hint="2–24 letters and numbers — saved in ALL CAPS.">
                  <input
                    value={promoCode}
                    onChange={(e) => {
                      // Uppercase as they type — this is exactly the string
                      // partygoers will copy (the server uppercases too).
                      setPromoCode(
                        e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 24)
                      );
                      if (errors.promoCode) setErrors((p) => ({ ...p, promoCode: '' }));
                    }}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={24}
                    placeholder="e.g., MONTY10"
                    className={`${inputClass} font-bold tracking-[2px]`}
                  />
                </Field>

                <Field label="Deal" error={errors.promoLabel}>
                  <input
                    value={promoLabel}
                    onChange={(e) => {
                      setPromoLabel(e.target.value.slice(0, 40));
                      if (errors.promoLabel) setErrors((p) => ({ ...p, promoLabel: '' }));
                    }}
                    maxLength={40}
                    placeholder="e.g., $5 off before 11"
                    className={inputClass}
                  />
                </Field>

                <Field label="Fine print" hint="Optional — how to actually use it.">
                  <input
                    value={promoHint}
                    onChange={(e) => setPromoHint(e.target.value.slice(0, 200))}
                    maxLength={200}
                    placeholder="e.g., Show the code at the door"
                    className={inputClass}
                  />
                </Field>

                <button
                  type="button"
                  onClick={() => {
                    // Clearing on close means a half-typed promo can't
                    // resurface in the payload later.
                    setPromoOpen(false);
                    setPromoCode('');
                    setPromoLabel('');
                    setPromoHint('');
                    setErrors((p) => ({ ...p, promoCode: '', promoLabel: '' }));
                  }}
                  className="text-sm font-montserrat text-white/50 underline"
                >
                  Remove promo code
                </button>
              </DashedCard>
            )}

            {error && <p className="text-red-400 text-sm font-montserrat">{error}</p>}
            <div className="flex gap-3">
              <SecondaryButton onClick={goBack} disabled={submitting}>
                Back
              </SecondaryButton>
              <PrimaryButton disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit for approval'}
              </PrimaryButton>
            </div>
          </form>
        )}

        {step === 'done' && (
          <div className="space-y-6 text-center py-8">
            <div className="mx-auto w-16 h-16 rounded-full bg-[#b24bf3]/20 flex items-center justify-center">
              <span className="text-[#b24bf3] text-2xl">✓</span>
            </div>
            <div>
              <h1 className="text-white text-2xl font-montserrat font-semibold">
                {manualUpload ? 'Posted — it’s live' : 'Submitted — awaiting approval'}
              </h1>
              <p className="text-white/60 text-sm font-montserrat mt-2">
                {manualUpload ? (
                  <>Manual uploads skip the approval queue — the party is on the feed now.</>
                ) : (
                  <>
                    Your party won&apos;t appear on the feed until an admin approves it
                    {selectedWeekend
                      ? `, and it stays scheduled until the ${formatWeekendRange(
                          selectedWeekend.thursdayDate,
                          selectedWeekend.saturdayDate
                        )} weekend goes live`
                      : ''}
                    . Track status under My parties.
                  </>
                )}
              </p>
            </div>
            <PrimaryButton type="button" onClick={() => router.push('/profile')}>
              View my parties
            </PrimaryButton>
            <Link href="/" className="block text-white/40 text-sm font-montserrat">
              Back to home
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}

const inputClass =
  'w-full px-4 py-3.5 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-white/40 font-montserrat focus:border-[#b24bf3] outline-none';

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/50 mb-1.5 font-montserrat">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="text-white/30 text-xs mt-1 font-montserrat">{hint}</p>}
      {error && <p className="text-red-400 text-sm mt-1 font-montserrat">{error}</p>}
    </div>
  );
}

function PrimaryButton({
  children,
  disabled,
  onClick,
  type = 'submit',
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'submit' | 'button';
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="flex-1 w-full py-3.5 rounded-xl font-montserrat font-semibold text-white bg-[#b24bf3] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-5 py-3.5 rounded-xl font-montserrat font-semibold text-white/70 border border-zinc-700 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
