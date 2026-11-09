'use client';

/**
 * Become a host — the WF-BH three-step flow that stands between "using the
 * app" and "posting on it":
 *
 *   1 · PITCH        sell the upside; prime that hosting is its own thing
 *   2 · ORG DETAILS  who you are (type, name, Instagram, house address)
 *   3 · PROOF        DM the word "claim" to @rafiatamir_ from the org's IG,
 *                    then wait out admin review
 *
 * The friction is the point (owner call): a deliberate application + a
 * campus-native proof step keeps trolls out with zero verification
 * infrastructure — only whoever controls the org's Instagram can send that
 * DM — and it frames hosting as an upgraded account we can attach a paid
 * tier to later. Approval flips is_host in Admin HQ; the server enforces
 * the gate on POST /parties regardless of anything this page does.
 */

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import SectionLabel from '@/components/ui/SectionLabel';
import DashedCard from '@/components/ui/DashedCard';
import AddressAutocomplete from '@/components/ui/AddressAutocomplete';
import { useAuth } from '@/contexts/AuthContext';
import { hostsApi } from '@/services/api';
import { trackEvent } from '@/utils/analytics';
import type { HostApplication } from '@/lib/types';

type OrgType = 'frat' | 'house' | 'other';
type Step = 'pitch' | 'form' | 'done';

/** What hosting gets you — the pitch bullets (only promises the app keeps today). */
const PITCH_POINTS = [
  'Your parties on the feed and the map',
  'Live going counts and ratings on every listing',
  'Promo codes that prove you packed the house',
];

export default function BecomeHostPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, needsOnboarding, refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<HostApplication | null>(null);
  // True while we bounce an already-set-up host over to /create — keeps the
  // spinner up so the application form never flashes during the redirect.
  const [redirecting, setRedirecting] = useState(false);
  const [step, setStep] = useState<Step>('pitch');

  const [orgType, setOrgType] = useState<OrgType>('frat');
  const [orgName, setOrgName] = useState('');
  const [instagram, setInstagram] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login?next=/become-host');
      return;
    }
    if (needsOnboarding) {
      router.replace('/onboarding?next=/become-host');
    }
  }, [isAuthenticated, isLoading, needsOnboarding, router]);

  useEffect(() => {
    if (!isAuthenticated || needsOnboarding) return;
    let cancelled = false;
    void (async () => {
      try {
        const me = await hostsApi.getMe();
        if (cancelled) return;
        setApplication(me.application);
        // Only a host account — an APPROVED application (or being an admin) —
        // skips this page. Parties render under the host account's org name,
        // so a legacy is_host flag alone still means "apply here first".
        if (me.application?.status === 'approved' || user?.isAdmin) {
          setRedirecting(true);
          router.replace('/create');
          return;
        }
        // Returning visitors land on the step that matches their state:
        // a pending application goes straight to the proof/pending screen.
        if (me.application?.status === 'pending') setStep('done');
      } catch {
        if (!cancelled) setError('Could not load host status');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, needsOnboarding, router, user]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const created = await hostsApi.apply({
        org_type: orgType,
        org_name: orgName.trim(),
        instagram: instagram.trim(),
        address: address.trim(),
      });
      setApplication(created);
      setStep('done');
      trackEvent('host_application_submitted', { orgType });
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !isAuthenticated || loading || redirecting) {
    return (
      <AppShell>
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-temple-purple" />
        </div>
      </AppShell>
    );
  }

  const rejected = application?.status === 'rejected';
  const stepIndex = step === 'pitch' ? 0 : step === 'form' ? 1 : 2;
  const inputClass =
    'w-full px-3.5 py-3 bg-black border border-white/15 rounded-[10px] text-white font-montserrat text-base focus:border-temple-purple focus:outline-none';

  return (
    <AppShell>
      {/* Vertically centered in the viewport (minus the tab bar) — the flow
          floats mid-screen instead of hugging the top. */}
      <div className="max-w-md mx-auto px-4 pb-[var(--dock-clearance)] pt-8 min-h-[calc(100dvh-90px)] flex flex-col lg:min-h-[calc(100dvh-160px)]">
        {/* my-auto (not justify-center) does the vertical centering: when the
            content is SHORT it floats mid-screen, and when it's taller than
            the viewport (dropdown open, keyboard up) it overflows downward
            normally — justify-center would clip the top off-screen where no
            amount of scrolling can reach it. */}
        <div className="my-auto w-full">
        {/* Step progress — three segments, purple up to where you are. */}
        <div className="flex gap-1.5 mb-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= stepIndex ? 'bg-temple-purple' : 'bg-white/10'}`}
            />
          ))}
        </div>

        {step === 'pitch' && (
          <div className="animate-slide-up-fade">
            <SectionLabel className="mb-2">BECOME A HOST</SectionLabel>
            <h1 className="text-white text-[26px] leading-8 font-montserrat font-bold mb-5">
              List your own parties
            </h1>

            <div className="bg-temple-surface-2 border border-white/10 rounded-[14px] divide-y divide-white/5 mb-5">
              {PITCH_POINTS.map((point) => (
                <div key={point} className="flex items-center gap-3 px-4 py-3.5">
                  <span className="size-1.5 shrink-0 rounded-full bg-temple-purple" aria-hidden />
                  <p className="text-white/90 text-[14px] font-montserrat">{point}</p>
                </div>
              ))}
            </div>

            {rejected && (
              <p className="text-red-400 text-sm font-montserrat mb-4">
                Your last application was rejected — you can apply again.
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                setStep('form');
                trackEvent('host_application_started');
              }}
              className="w-full py-3 rounded-[10px] bg-temple-purple text-white font-montserrat font-bold text-[14px] uppercase hover:opacity-90 active:scale-[0.98] transition-all duration-150"
            >
              Start
            </button>

            <p className="mt-4 text-center text-temple-muted text-[12px] font-montserrat">
              Hosting is a separate account level — applications are reviewed by a human.
            </p>
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={submit} className="space-y-4 animate-slide-up-fade">
            <h1 className="text-white text-[26px] leading-8 font-montserrat font-bold">Your org</h1>

            <div className="flex gap-2">
              {(['frat', 'house', 'other'] as OrgType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOrgType(t)}
                  className={`flex-1 py-2 rounded-[10px] text-[12px] font-bold uppercase tracking-[0.5px] font-montserrat transition-colors ${
                    orgType === t
                      ? 'bg-temple-purple text-white'
                      : 'border border-white/15 text-temple-muted hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <input
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value.slice(0, 60))}
              placeholder="Org name"
              className={inputClass}
            />
            <input
              required
              value={instagram}
              onChange={(e) =>
                setInstagram(e.target.value.replace(/[^a-zA-Z0-9._@]/g, '').slice(0, 31))
              }
              placeholder="@instagram"
              className={inputClass}
            />
            {/* Same autocomplete as the create-party form — the suggestion's
                clean label beats a hand-typed address in the admin queue. */}
            <AddressAutocomplete
              value={address}
              onChange={(v) => setAddress(v.slice(0, 500))}
              onSelect={(addr) => setAddress(addr)}
              placeholder="House address"
              inputClassName={inputClass}
            />
            <p className="text-temple-muted text-[12px] font-montserrat">
              Address stays gated behind .edu accounts — always.
            </p>

            {error && <p className="text-red-400 text-sm font-montserrat">{error}</p>}

            <button
              type="submit"
              disabled={submitting || !orgName.trim() || !instagram.trim() || !address.trim()}
              className="w-full py-3 rounded-[10px] bg-temple-purple text-white font-montserrat font-bold text-[14px] uppercase disabled:opacity-40 hover:opacity-90 active:scale-[0.98] transition-all duration-150"
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </form>
        )}

        {step === 'done' && application && (
          <div className="animate-slide-up-fade">
            <h1 className="text-white text-[26px] leading-8 font-montserrat font-bold mb-1">
              One more thing
            </h1>
            <p className="text-temple-muted text-[13px] font-montserrat mb-5">
              {application.orgName} · @{application.instagram}
            </p>

            {/* The proof step: only whoever runs the org's Instagram can send this. */}
            <a
              href="https://www.instagram.com/rafiatamir_"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-temple-surface-2 border border-white/10 rounded-[14px] px-4 py-4 mb-3 hover:border-white/20 transition-colors"
            >
              <p className="text-white font-montserrat font-bold text-[15px]">
                DM the word &quot;claim&quot; to @rafiatamir_ on IG
              </p>
              <p className="text-temple-muted text-[13px] font-montserrat mt-1">
                from your org&apos;s Instagram — that&apos;s the whole verification
              </p>
            </a>

            <DashedCard className="py-3 text-center mb-3">
              <p className="font-montserrat font-bold text-[11px] tracking-[0.88px] uppercase text-temple-muted">
                PENDING REVIEW — USUALLY SAME DAY
              </p>
            </DashedCard>

            <p className="text-temple-muted text-[12px] font-montserrat text-center">
              Once approved, you can post parties straight from your profile.
            </p>
          </div>
        )}

        <p className="mt-6 text-center">
          <Link
            href="/profile"
            className="text-temple-muted text-sm font-montserrat underline underline-offset-2 hover:text-white transition-colors"
          >
            Back to profile
          </Link>
        </p>
        </div>
      </div>
    </AppShell>
  );
}
