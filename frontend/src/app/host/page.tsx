'use client';

/**
 * Host profile — the read-only view of a host account's org identity, as
 * approved from their application: org name + type, Instagram, house
 * address. NOTHING here is editable yet (deliberate — the org identity is
 * what admin approved; letting hosts rewrite it would undo the vetting).
 * Changes go through a DM to @tuparties until host settings ship.
 *
 * This is also the seam where the paid host tier lands later: the upgrade
 * pitch belongs on this page.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import Header from '@/components/Header';
import Pill from '@/components/ui/Pill';
import SectionLabel from '@/components/ui/SectionLabel';
import { useAuth } from '@/contexts/AuthContext';
import { hostsApi } from '@/services/api';
import type { HostApplication } from '@/lib/types';

export default function HostProfilePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, needsOnboarding } = useAuth();

  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<HostApplication | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login?next=/host');
      return;
    }
    if (needsOnboarding) {
      router.replace('/onboarding');
    }
  }, [isAuthenticated, isLoading, needsOnboarding, router]);

  useEffect(() => {
    if (!isAuthenticated || needsOnboarding) return;
    let cancelled = false;
    void (async () => {
      try {
        const me = await hostsApi.getMe();
        if (cancelled) return;
        if (!me.isHost || me.application?.status !== 'approved') {
          // Not an approved host org — nothing to show here.
          router.replace('/profile');
          return;
        }
        setApplication(me.application);
      } catch {
        if (!cancelled) router.replace('/profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, needsOnboarding, router]);

  if (isLoading || !isAuthenticated || loading || !application) {
    return (
      <AppShell>
        <div className="flex justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-temple-purple" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="pb-[var(--dock-clearance)] lg:pb-8">
        <Header title="Host profile" />

        <div className="max-w-xl mx-auto px-4 sm:px-6 pt-3 flex flex-col gap-3.5 lg:pt-6">
          {/* Org identity card — this is what admin approved. */}
          <div className="flex items-center gap-4 bg-temple-surface-2 border border-white/10 rounded-[14px] p-4 animate-slide-up-fade">
            <div className="size-14 shrink-0 rounded-full bg-temple-purple/30 flex items-center justify-center">
              <span className="text-temple-purple-light text-xl font-montserrat font-bold">
                {application.orgName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-white text-[20px] leading-6 font-montserrat font-bold truncate">
                {application.orgName}
              </h2>
              <div className="mt-1.5">
                <Pill tone="accent" size="xs" shape="square">{application.orgType}</Pill>
              </div>
            </div>
          </div>

          <div className="bg-temple-surface-2 border border-white/10 rounded-[14px] divide-y divide-white/5">
            <div className="px-4 py-3">
              <p className="text-temple-muted text-[10px] font-montserrat font-bold uppercase tracking-[1px]">
                Instagram
              </p>
              <p className="font-montserrat text-[14px] text-white mt-1">@{application.instagram}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-temple-muted text-[10px] font-montserrat font-bold uppercase tracking-[1px]">
                House address
              </p>
              <p className="font-montserrat text-[14px] text-white mt-1">{application.address}</p>
            </div>
          </div>

          <p className="text-temple-muted text-[12px] font-montserrat px-0.5">
            Host details aren&apos;t editable yet — DM{' '}
            <a
              href="https://www.instagram.com/tuparties"
              target="_blank"
              rel="noopener noreferrer"
              className="text-temple-purple-light underline underline-offset-2"
            >
              @tuparties
            </a>{' '}
            to change anything. Parties you post always list under {application.orgName}.
          </p>

          <Link
            href="/create"
            className="w-full py-3 rounded-[10px] bg-temple-purple text-white font-montserrat font-bold text-[14px] uppercase text-center hover:opacity-90 active:scale-[0.98] transition-all duration-150"
          >
            Create a party
          </Link>

          <SectionLabel className="mt-1">COMING TO HOST ACCOUNTS</SectionLabel>
          <div className="bg-temple-surface-2 border border-white/10 rounded-[14px] divide-y divide-white/5">
            {['Live dashboard — going counts, ratings, promo redemptions', 'Announcements straight to your RSVPs', 'Verified badge'].map((line) => (
              <div key={line} className="flex items-center gap-3 px-4 py-3">
                <span className="size-1.5 shrink-0 rounded-full bg-white/20" aria-hidden />
                <p className="text-temple-muted text-[13px] font-montserrat">{line}</p>
              </div>
            ))}
          </div>

          <p className="text-center">
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
