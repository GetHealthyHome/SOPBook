import Head from 'next/head';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { CompanyDetails } from './companyDetails';

/**
 * Shared shell for the legal and compliance pages.
 *
 * These live outside the app proper because two of them must be readable
 * without signing in: somebody redeeming an invitation should be able to read
 * what they are agreeing to before they choose a password.
 *
 * The company details they quote are settings, resolved server-side on each
 * request and passed in — see src/lib/companyDetails.ts. They were constants
 * here originally, which meant an admin could not change them without a code
 * edit, and unfilled ones sat on a live page indefinitely.
 *
 * ---------------------------------------------------------------------------
 * BEFORE RELYING ON THESE DOCUMENTS
 *
 * The content was written against what this application actually does — every
 * field it stores, every service it sends data to, every record it keeps — so
 * it is accurate rather than boilerplate. It has NOT been reviewed by a
 * lawyer, and it is not legal advice.
 *
 * Employee privacy notices carry real obligations in several states, and this
 * app holds injury records containing dates of birth, home addresses and
 * medical detail.
 * ---------------------------------------------------------------------------
 */

/** Bumped by hand when the wording changes materially. */
export const LAST_UPDATED = 'August 2026';

export const LEGAL_PAGES = [
  { href: '/terms',   label: 'Terms of Use' },
  { href: '/privacy', label: 'Privacy Notice' },
  { href: '/rights',  label: 'Your Safety Rights' },
];

/** Small link row, used at the foot of the sign-in and set-password screens. */
export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs text-gray-400 font-bold text-center leading-relaxed ${className}`}>
      {LEGAL_PAGES.map((p, i) => (
        <span key={p.href}>
          {i > 0 && <span className="mx-1.5 text-gray-300">·</span>}
          <Link href={p.href} className="hover:text-gray-600 transition-colors">{p.label}</Link>
        </span>
      ))}
    </p>
  );
}

export function LegalPage({ title, intro, company, children }: {
  title: string;
  intro: string;
  company: CompanyDetails;
  children: ReactNode;
}) {
  const incomplete = Object.values(company).some(v => v.startsWith('['));
  return (
    <>
      <Head>
        <title>{`${title} · Healthy Home Field Guide`}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-gray-50 px-5 py-8 lg:py-12">
        <div className="w-full max-w-[680px] mx-auto">
          <div className="flex items-center gap-2.5 mb-6">
            <img src="/logo.svg?v=4" alt="" className="w-9 h-9" />
            <div>
              <p className="text-sm font-black text-gray-900 leading-none">Healthy Home</p>
              <p className="text-xs text-gray-500 font-bold mt-0.5">Field Guide</p>
            </div>
          </div>

          {incomplete && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 mb-4">
              <p className="text-sm text-amber-900 font-bold leading-snug">
                Some company details on this page have not been filled in yet. An administrator can
                set them under Admin Console → Compliance → Company Details.
              </p>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-2xl p-6 lg:p-8">
            <h1 className="text-2xl font-black text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 font-bold mt-1">Last updated {LAST_UPDATED}</p>
            <p className="text-base text-gray-700 leading-relaxed mt-4">{intro}</p>
            <div className="mt-6 space-y-6">{children}</div>
          </div>

          <div className="mt-6 flex flex-col items-center gap-3">
            <Link
              href="/"
              className="inline-block h-11 leading-[2.75rem] px-6 bg-white border border-gray-200 hover:border-emerald-300 rounded-xl text-sm font-black text-gray-700 transition-colors"
            >
              Back to the Field Guide
            </Link>
            <LegalLinks />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Load the company details for a legal page.
 *
 * Server-side on every request rather than at build time, so a change in the
 * admin console shows up immediately instead of at the next deploy. These
 * pages are public, so there is no session to check.
 */
export async function loadCompanyProps() {
  const { getSupabase } = await import('./supabaseServer');
  const { resolveCompany } = await import('./companyDetails');
  const { logError } = await import('./log');
  try {
    const { data, error } = await getSupabase().from('app_settings').select('key, value');
    if (error) throw error;
    const bag: Record<string, string> = {};
    for (const row of data ?? []) bag[row.key] = row.value;
    return { props: { company: resolveCompany(bag) } };
  } catch (err) {
    logError('legal/loadCompany', err);
    // A database hiccup must not take a legal page offline. Fall back to the
    // placeholders, which is exactly what an unconfigured install shows.
    const { resolveCompany } = await import('./companyDetails');
    return { props: { company: resolveCompany({}) } };
  }
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-black text-gray-900 mb-2">{heading}</h2>
      <div className="space-y-3 text-base text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5 list-disc list-outside ml-5">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

/** A callout for the things that matter most — used sparingly. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
      <p className="text-sm text-amber-900 font-semibold leading-relaxed">{children}</p>
    </div>
  );
}
