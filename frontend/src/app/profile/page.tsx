'use client';

/**
 * Profile — view + edit your identity, reach host/admin tools, see your
 * listings, log out (Epic 6.6 / 8.5), on the v2 design system.
 *
 * Layout: identity card (avatar + handle) → the one primary action for your
 * role (create a party / become a host) → details card (school year, Greek
 * life, Instagram — tap Edit, save inline) → MY PARTIES with status chips →
 * log out. All surfaces speak the feed-card language: surface-2, hairline
 * borders, square chips, purple accents.
 */

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import Header from '@/components/Header';
import SectionLabel from '@/components/ui/SectionLabel';
import { useAuth } from '@/contexts/AuthContext';
import { GRAD_YEARS, schoolYearLabel } from '@/lib/onboarding';
import { partiesApi, hostsApi } from '@/services/api';
import { resizeAvatarFile } from '@/utils/avatarImage';
import { displayDoorTime, getDayShort } from '@/utils/dateHelpers';
import type { Party, HostApplication } from '@/lib/types';

export default function ProfilePage() {
  const router = useRouter();
  const {
    user,
    isAuthenticated,
    isLoading,
    needsOnboarding,
    updateProfile,
    uploadAvatar,
    logout,
  } = useAuth();

  const [editing, setEditing] = useState<'none' | 'school' | 'greek' | 'instagram'>('none');
  const [schoolYear, setSchoolYear] = useState('');
  const [greekLife, setGreekLife] = useState('');
  const [instagram, setInstagram] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myParties, setMyParties] = useState<Party[]>([]);
  const [partiesLoading, setPartiesLoading] = useState(true);
  // Latest host application — drives the pending/rejected status card and
  // (once approved) the link to the host profile page.
  const [hostApplication, setHostApplication] = useState<HostApplication | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login?next=/profile');
      return;
    }
    if (needsOnboarding) {
      router.replace('/onboarding');
    }
  }, [isAuthenticated, isLoading, needsOnboarding, router]);

  useEffect(() => {
    if (!user) return;
    setSchoolYear(user.schoolYear || '');
    setGreekLife(user.greekLife || '');
    setInstagram(user.instagram || '');
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated || needsOnboarding) return;
    let cancelled = false;
    void (async () => {
      setPartiesLoading(true);
      try {
        const list = await partiesApi.getMyParties();
        if (!cancelled) setMyParties(list);
      } catch {
        if (!cancelled) setMyParties([]);
      } finally {
        if (!cancelled) setPartiesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, needsOnboarding]);

  useEffect(() => {
    if (!isAuthenticated || needsOnboarding) return;
    let cancelled = false;
    void (async () => {
      try {
        const me = await hostsApi.getMe();
        if (!cancelled) setHostApplication(me.application);
      } catch {
        // Status card is decorative — the page works fine without it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, needsOnboarding]);

  const saveField = async (fields: Parameters<typeof updateProfile>[0]) => {
    setSubmitting(true);
    setError('');
    setInfo('');
    const result = await updateProfile(fields);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error || 'Could not save');
      return false;
    }
    setInfo('Saved');
    setEditing('none');
    return true;
  };

  const onAvatarFile = async (file: File | null) => {
    if (!file) return;
    setSubmitting(true);
    setError('');
    try {
      const blob = await resizeAvatarFile(file);
      const result = await uploadAvatar(blob);
      if (!result.success) {
        setError(result.error || 'Upload failed');
      } else {
        setInfo('Photo updated');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process image');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  if (isLoading || !isAuthenticated || !user || needsOnboarding) {
    return (
      <AppShell>
        <div className="flex justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-temple-purple" />
        </div>
      </AppShell>
    );
  }

  const initial = (user.username || user.email || '?').charAt(0).toUpperCase();
  const canPost = user.isHost || user.isAdmin;

  return (
    <AppShell>
      <div className="pb-[var(--dock-clearance)] lg:pb-8">
        <Header title="Profile" />

        <div className="max-w-xl mx-auto px-4 sm:px-6 pt-3 flex flex-col gap-3.5 lg:pt-6">
          {/* Identity card: avatar (tap to change) + handle + email. */}
          <div className="flex items-center gap-4 bg-temple-surface-2 border border-white/10 rounded-[14px] p-4 animate-slide-up-fade">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
              className="relative shrink-0 size-16 rounded-full overflow-visible disabled:opacity-60"
              aria-label="Change profile picture"
            >
              <span className="block size-16 rounded-full overflow-hidden bg-temple-purple/30">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-temple-purple-light text-2xl font-montserrat font-bold">
                    {initial}
                  </span>
                )}
              </span>
              {/* Little "+" badge — the hint that the avatar is editable. */}
              <span className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-temple-purple-light text-black text-[13px] leading-none font-bold flex items-center justify-center border-2 border-temple-surface-2">
                +
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void onAvatarFile(e.target.files?.[0] ?? null)}
            />
            <div className="min-w-0">
              <h2 className="text-white text-[20px] leading-6 font-montserrat font-bold truncate">
                @{user.username}
              </h2>
              <p className="text-temple-muted text-[12.5px] font-montserrat truncate mt-0.5">
                {user.email}
              </p>
            </div>
          </div>

          {/* The one primary action for this account's role — plus, where an
              application is in flight, its status instead of a dead CTA. */}
          {canPost ? (
            <>
              {/* Host profile leads; Create a party sits under it. Both share
                  the same footprint so the pair reads as one control group. */}
              {user.isHost && hostApplication?.status === 'approved' && (
                <Link
                  href="/host"
                  className="w-full flex items-center justify-between px-4 py-3 rounded-[10px] border border-white/15 font-montserrat text-[14px] tracking-[0.5px] uppercase hover:border-white/30 transition-colors"
                >
                  <span className="font-bold text-white">
                    Host profile
                    <span className="ml-2 font-medium normal-case tracking-normal text-temple-purple-light">
                      {hostApplication.orgName}
                    </span>
                  </span>
                  <span className="text-temple-muted" aria-hidden>›</span>
                </Link>
              )}
              <Link
                href="/create"
                className="w-full py-3 rounded-[10px] bg-temple-purple text-white font-montserrat font-bold text-[14px] uppercase text-center hover:opacity-90 active:scale-[0.98] transition-all duration-150"
              >
                Create a party
              </Link>
            </>
          ) : hostApplication?.status === 'pending' ? (
            <Link
              href="/become-host"
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-[14px] bg-temple-surface-2 border border-white/10 hover:border-white/20 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-white font-montserrat font-bold text-[14px] truncate">
                  Host application · {hostApplication.orgName}
                </p>
                <p className="text-temple-muted text-[12px] font-montserrat mt-0.5">
                  DM &quot;claim&quot; to @rafiatamir_ if you haven&apos;t yet
                </p>
              </div>
              <span className="shrink-0 font-montserrat font-bold text-[10px] tracking-[0.8px] uppercase px-2.5 py-1.5 rounded bg-amber-500/20 text-amber-200">
                IN REVIEW
              </span>
            </Link>
          ) : hostApplication?.status === 'rejected' ? (
            <Link
              href="/become-host"
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-[14px] bg-temple-surface-2 border border-white/10 hover:border-white/20 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-white font-montserrat font-bold text-[14px] truncate">
                  Host application · {hostApplication.orgName}
                </p>
                <p className="text-temple-muted text-[12px] font-montserrat mt-0.5">
                  Tap to apply again
                </p>
              </div>
              <span className="shrink-0 font-montserrat font-bold text-[10px] tracking-[0.8px] uppercase px-2.5 py-1.5 rounded bg-red-500/20 text-red-300">
                REJECTED
              </span>
            </Link>
          ) : (
            <Link
              href="/become-host"
              className="w-full py-3 rounded-[10px] bg-temple-purple text-white font-montserrat font-bold text-[14px] uppercase text-center hover:opacity-90 active:scale-[0.98] transition-all duration-150"
            >
              Become a host
            </Link>
          )}

          {user.isAdmin && (
            <Link
              href="/admin"
              className="w-full flex items-center justify-between px-4 py-3 rounded-[10px] border border-white/15 text-white font-montserrat font-bold text-[12px] tracking-[0.5px] uppercase hover:border-white/30 transition-colors"
            >
              Admin dashboard
              <span className="text-temple-muted" aria-hidden>›</span>
            </Link>
          )}

          {/* Details card: one surface, divided rows, inline edit. */}
          <div className="bg-temple-surface-2 border border-white/10 rounded-[14px] divide-y divide-white/5">
            <ProfileRow
              label="Grad year"
              value={schoolYearLabel(user.schoolYear) || '—'}
              onEdit={() => setEditing('school')}
            />
            <ProfileRow
              label="Greek life"
              value={user.greekLife || 'Not set'}
              onEdit={() => setEditing('greek')}
              muted={!user.greekLife}
            />
            <ProfileRow
              label="Instagram"
              value={user.instagram ? `@${user.instagram}` : 'Not set'}
              onEdit={() => setEditing('instagram')}
              muted={!user.instagram}
            />
          </div>

          {editing === 'school' && (
            <EditCard title="Grad year" onClose={() => setEditing('none')}>
              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  void saveField({ school_year: schoolYear });
                }}
                className="space-y-2.5"
              >
                {GRAD_YEARS.map((y) => (
                  <button
                    key={y.value}
                    type="button"
                    onClick={() => setSchoolYear(y.value)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-[10px] border font-montserrat text-sm transition-colors ${
                      schoolYear === y.value
                        ? 'border-temple-purple text-white bg-temple-purple/10'
                        : 'border-white/15 text-white/70 hover:border-white/30'
                    }`}
                  >
                    {y.label}
                  </button>
                ))}
                <SaveButton disabled={submitting || !schoolYear} />
              </form>
            </EditCard>
          )}

          {editing === 'greek' && (
            <EditCard title="Greek life" onClose={() => setEditing('none')}>
              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  void saveField({ greek_life: greekLife.trim() || '' });
                }}
                className="space-y-2.5"
              >
                <input
                  value={greekLife}
                  onChange={(e) => setGreekLife(e.target.value.slice(0, 100))}
                  placeholder="Chapter or org"
                  className="w-full px-3.5 py-2.5 bg-black border border-white/15 rounded-[10px] text-white font-montserrat text-base focus:border-temple-purple focus:outline-none"
                />
                <SaveButton disabled={submitting} />
              </form>
            </EditCard>
          )}

          {editing === 'instagram' && (
            <EditCard title="Instagram" onClose={() => setEditing('none')}>
              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  void saveField({ instagram: instagram.trim() || '' });
                }}
                className="space-y-2.5"
              >
                <input
                  value={instagram}
                  onChange={(e) =>
                    setInstagram(e.target.value.replace(/[^a-zA-Z0-9._]/g, '').slice(0, 30))
                  }
                  placeholder="handle"
                  className="w-full px-3.5 py-2.5 bg-black border border-white/15 rounded-[10px] text-white font-montserrat text-base focus:border-temple-purple focus:outline-none"
                />
                <SaveButton disabled={submitting} />
              </form>
            </EditCard>
          )}

          <section>
            <SectionLabel className="mb-2.5 mt-1">
              MY PARTIES{myParties.length > 0 && ` · ${myParties.length}`}
            </SectionLabel>
            {partiesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-temple-purple" />
              </div>
            ) : myParties.length === 0 ? (
              <div className="px-4 py-6 rounded-[14px] bg-temple-surface-2 border border-white/10 text-center">
                <p className="text-temple-muted text-sm font-montserrat mb-3">No listings yet</p>
                <Link
                  href={canPost ? '/create' : '/become-host'}
                  className="text-temple-purple-light text-sm font-montserrat font-semibold underline underline-offset-2"
                >
                  {canPost ? 'Create your first party' : 'Become a host'}
                </Link>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {myParties.map((party) => (
                  <MyPartyRow key={party.id} party={party} />
                ))}
              </ul>
            )}
          </section>

          {error && <p className="text-red-400 text-sm font-montserrat">{error}</p>}
          {info && <p className="text-temple-purple-light text-sm font-montserrat">{info}</p>}

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="w-full py-3 rounded-[10px] font-montserrat font-bold text-[12px] tracking-[0.5px] uppercase text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </AppShell>
  );
}

/** Status chip for a listing — square chip, same shape language as the tags. */
function statusStyles(status: string | undefined): { label: string; className: string } {
  switch (status) {
    case 'approved':
      return { label: 'LIVE', className: 'bg-temple-purple-light text-black' };
    case 'rejected':
      return { label: 'REJECTED', className: 'bg-red-500/20 text-red-300' };
    case 'pending':
    default:
      return { label: 'IN REVIEW', className: 'bg-amber-500/20 text-amber-200' };
  }
}

function MyPartyRow({ party }: { party: Party }) {
  const badge = statusStyles(party.status);
  const inner = (
    <>
      <div className="min-w-0">
        <p className="text-white font-montserrat font-bold text-[14.5px] truncate">{party.title}</p>
        <p className="text-temple-muted text-[12px] font-montserrat mt-1">
          {getDayShort(party.day)} · {displayDoorTime(party.doorsOpen)}
        </p>
      </div>
      <span
        className={`shrink-0 font-montserrat font-bold text-[10px] tracking-[0.8px] uppercase px-2.5 py-1.5 rounded ${badge.className}`}
      >
        {badge.label}
      </span>
    </>
  );

  // Only live listings have a public page to link to.
  if (party.status === 'approved') {
    return (
      <Link
        href={`/party/${party.id}`}
        className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-[14px] bg-temple-surface-2 border border-white/10 hover:border-white/20 transition-colors"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-[14px] bg-temple-surface-2 border border-white/10">
      {inner}
    </div>
  );
}

function ProfileRow({
  label,
  value,
  onEdit,
  muted,
}: {
  label: string;
  value: string;
  onEdit: () => void;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-temple-muted text-[10px] font-montserrat font-bold uppercase tracking-[1px]">
          {label}
        </p>
        <p className={`font-montserrat text-[14px] mt-1 truncate ${muted ? 'text-temple-muted' : 'text-white'}`}>
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 font-montserrat font-bold text-[11px] tracking-[0.5px] uppercase text-temple-purple-light hover:text-white transition-colors"
      >
        Edit
      </button>
    </div>
  );
}

function EditCard({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-[14px] border border-temple-purple/40 bg-temple-surface animate-scale-in">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-white font-montserrat font-bold text-[15px]">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-temple-muted text-[12px] font-montserrat font-semibold uppercase tracking-[0.5px] hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
      {children}
    </div>
  );
}

function SaveButton({ disabled }: { disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full py-2.5 rounded-[10px] bg-temple-purple text-white font-montserrat font-bold text-[13px] uppercase disabled:opacity-50 hover:opacity-90 active:scale-[0.98] transition-all duration-150"
    >
      Save
    </button>
  );
}
