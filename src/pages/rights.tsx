import Link from 'next/link';
import { LegalPage, Section, Bullets, Note, loadCompanyProps } from '@/lib/legal';
import type { CompanyDetails } from '@/lib/companyDetails';

export default function Rights({ company }: { company: CompanyDetails }) {
  const COMPANY = company;
  return (
    <LegalPage
      company={company}
      title="Your Safety Rights"
      intro="A plain summary of what OSHA guarantees you at work, and how those rights connect to what this app does. Nothing here is a company policy — these are rights under federal law, and they apply whether or not anyone reminds you of them."
    >
      <Section heading="You can refuse work you reasonably believe will kill or seriously injure you">
        <p>
          If a task presents a real danger of death or serious physical harm, you have asked your
          employer to fix it, there is not enough time to get it resolved through normal channels,
          and a reasonable person in your position would agree — you may refuse to do it, and you
          are protected for refusing.
        </p>
        <Note>
          Stop work first and sort it out afterwards. Nobody at {COMPANY.shortName} will be
          penalised for stopping a job over a genuine safety concern. Raise it with{' '}
          {COMPANY.safetyContact}.
        </Note>
      </Section>

      <Section heading="You can report an injury without retaliation">
        <p>
          Under 29 CFR 1904.36 and Section 11(c) of the OSH Act, it is illegal to discharge or
          discriminate against you for reporting a work-related injury or illness, for raising a
          safety concern, or for talking to OSHA.
        </p>
        <p>
          That covers firing, demotion, cut hours, reassignment, or any other action taken against
          you because you reported something. Incident reports filed in this app are expected and
          protected.
        </p>
      </Section>

      <Section heading="You can see the injury records">
        <p>Under 29 CFR 1904.35 you are entitled to:</p>
        <Bullets items={[
          <>A copy of the <strong className="text-gray-900">OSHA 300 log</strong> for any establishment where you work or have worked — by the end of the next business day, free.</>,
          <>A copy of the <strong className="text-gray-900">OSHA 301 incident report</strong> for any incident involving you — by the end of the next business day.</>,
          <>A copy of the <strong className="text-gray-900">OSHA 300A summary</strong> for any year.</>,
        ]} />
        <p>
          Ask {COMPANY.safetyContact}. The Field Guide generates all three forms, so this is a
          matter of asking rather than of anyone digging through paperwork.
        </p>
      </Section>

      <Section heading="The annual summary must be posted">
        <p>
          The OSHA 300A summary for the previous year has to be posted somewhere employees can see
          it, from <strong className="text-gray-900">1 February to 30 April</strong> each year,
          signed by a company executive. It must stay up for the whole period, including in
          years with no recordable injuries.
        </p>
      </Section>

      <Section heading="You can talk to OSHA">
        <p>
          You may file a complaint and ask for an inspection if you believe there is a serious
          hazard or that safety rules are not being followed. You can ask that your name not be
          revealed to your employer.
        </p>
        <Bullets items={[
          <>Online at <span className="font-mono text-sm">osha.gov/workers</span></>,
          <>By phone on <span className="font-mono text-sm">1-800-321-6742</span> (1-800-321-OSHA)</>,
          <>A retaliation complaint must generally be filed within <strong className="text-gray-900">30 days</strong> of the retaliation.</>,
        ]} />
        <p>
          You are not required to raise it internally first. We would rather hear about it and fix
          it — but that is a preference, not a condition.
        </p>
      </Section>

      <Section heading="What is kept about an injury">
        <p>
          Injury records contain sensitive personal detail. How that is handled, who can see it,
          and how to keep your name off the OSHA 300 log for a privacy concern case is set out in
          the <Link href="/privacy" className="text-emerald-700 font-bold underline">Privacy Notice</Link>.
        </p>
      </Section>

      <Section heading="Raising something">
        <p>
          Safety concerns: {COMPANY.safetyContact}. Anything about this app or these documents:{' '}
          {COMPANY.contactEmail}.
        </p>
      </Section>
    </LegalPage>
  );
}

export const getServerSideProps = loadCompanyProps;
