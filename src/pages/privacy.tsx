import { LegalPage, Section, Bullets, Note, loadCompanyProps } from '@/lib/legal';
import type { CompanyDetails } from '@/lib/companyDetails';

export default function Privacy({ company }: { company: CompanyDetails }) {
  const COMPANY = company;
  return (
    <LegalPage
      company={company}
      title="Privacy Notice"
      intro={`This explains what the Healthy Home Field Guide records about you, why, who can see it, and how long it is kept. It covers employees and contractors of ${COMPANY.legalName} who use the app. It describes this app only — not every record the company holds about you.`}
    >
      <Section heading="What the app holds about you">
        <p><strong className="text-gray-900">Your account.</strong> Name, work email address, job title, division, and whether you are an administrator. Your password is stored one-way (scrypt) and cannot be read by anyone, including administrators.</p>

        <p><strong className="text-gray-900">What you have read and completed.</strong> Which procedures you signed off and at which version, with the date and time. Which handbook sections you acknowledged. Which training modules you completed, and who verified them. Certifications and badges held, and who assigned them. Career track assignments and completed tasks.</p>

        <p><strong className="text-gray-900">What you have submitted.</strong> Incident reports you file, procedure suggestions, and any photos you upload.</p>

        <p><strong className="text-gray-900">Messages sent to you.</strong> A log of invitation and reminder emails: the address, subject, date, and whether it was delivered. Not the full message body.</p>

        <p><strong className="text-gray-900">Injury and illness records.</strong> Where an incident involves an injury or illness, the report can hold considerably more: name, job title, home address, date of birth, sex, date of hire, what happened, the injury itself, the treating physician or facility, whether emergency treatment or hospitalisation occurred, days away from work or on restricted duty, and — in the worst case — date of death. This is the most sensitive information in the app and is covered separately below.</p>

        <p><strong className="text-gray-900">Not collected.</strong> The app does not track your location, does not use advertising or analytics cookies, and does not run third-party trackers. Your IP address is checked briefly to limit repeated sign-in attempts, in memory only, and is not stored.</p>
      </Section>

      <Section heading="Why it is held">
        <Bullets items={[
          <>To give you access and keep the account secure.</>,
          <>To show that procedures, safety information and training were provided and acknowledged — a legal obligation, and the reason sign-off records exist.</>,
          <>To meet OSHA injury and illness recordkeeping requirements under 29 CFR Part 1904.</>,
          <>To manage work: assigning training, tracking certifications, and following up on incidents and damage.</>,
          <>To send you invitations and reminders about outstanding sign-offs.</>,
        ]} />
        <p>
          None of it is sold, and none of it is used for advertising or for any purpose unrelated
          to your work.
        </p>
      </Section>

      <Section heading="Who can see it">
        <Bullets items={[
          <><strong className="text-gray-900">You</strong> — your own record, training, badges and the incidents you reported.</>,
          <><strong className="text-gray-900">Administrators</strong> — the full team roster, all sign-off and training records, all incident reports including injury details, and the email log.</>,
          <><strong className="text-gray-900">Other team members</strong> — names, job titles, divisions and badges. Not your email address, not your incident reports, and not internal review notes.</>,
        ]} />
        <p>
          Information may also be disclosed where the law requires it — for example to OSHA or a
          state agency during an inspection, or to a workers&rsquo; compensation insurer handling a
          claim.
        </p>
      </Section>

      <Section heading="Injury and illness records">
        <p>
          These are handled more carefully than anything else in the app.
        </p>
        <Bullets items={[
          <>They are visible only to administrators, and to you for your own.</>,
          <>Certain incidents are treated as <em>privacy concern cases</em> under 29 CFR 1904.29(b)(6)&ndash;(9). For those, the name is withheld from the OSHA 300 log and &ldquo;Privacy Case&rdquo; is entered instead. This applies to injuries to an intimate body part, sexual assaults, mental illnesses, HIV, hepatitis, tuberculosis, needlestick and sharps injuries, and any case where the employee has asked for their name to be kept off the log.</>,
          <>When an OSHA 300 log is shared with anyone other than a government representative or someone with a specific need, the personal identifiers are removed first.</>,
        ]} />
        <Note>
          If you would rather your name did not appear on the OSHA 300 log for an injury you have
          reported, you can ask. Contact {COMPANY.safetyContact}.
        </Note>
      </Section>

      <Section heading="Where the data lives">
        <p>The Field Guide runs on three outside services. Each holds data only to provide the service, and none of them sells it.</p>
        <Bullets items={[
          <><strong className="text-gray-900">Supabase</strong> — the database and photo storage. Everything described above is held here.</>,
          <><strong className="text-gray-900">Vercel</strong> — hosts the application and runs the server code.</>,
          <><strong className="text-gray-900">Resend</strong> — sends invitation and reminder emails. Receives your name, email address and the message text; never your password, and never injury details.</>,
        ]} />
      </Section>

      <Section heading="How it is protected">
        <Bullets items={[
          <>Passwords are hashed one-way with scrypt and are unreadable, including to administrators.</>,
          <>Sessions use a signed, HTTP-only cookie that browser scripts cannot read, and expire after eight hours.</>,
          <>Changing or resetting a password ends every existing session for that account immediately, rather than leaving old sessions alive for hours.</>,
          <>Every database table is closed to direct access. All reads and writes go through the application, which checks who you are on each request against the live account rather than trusting a cookie.</>,
          <>Invitation links are single-use, expire after seven days, and are stored only as a one-way hash, so a copy of the database yields no working link.</>,
          <>All traffic is encrypted in transit.</>,
        ]} />
      </Section>

      <Section heading="How long it is kept">
        <Bullets items={[
          <><strong className="text-gray-900">Injury and illness records</strong> — five years following the calendar year they cover, as OSHA requires under 29 CFR 1904.33.</>,
          <><strong className="text-gray-900">Sign-off, acknowledgement and training records</strong> — kept while you are with the company and for a period afterwards, so it can still be shown what was communicated and when.</>,
          <><strong className="text-gray-900">Your account</strong> — when it is deleted, badges, career records, notifications and any outstanding invitations are deleted with it. Sign-off records, incident reports and OSHA records remain, because they document events that happened.</>,
        ]} />
      </Section>

      <Section heading="Your rights">
        <p>
          Under 29 CFR 1904.35 you may see and copy the OSHA 300 log for any establishment where
          you work or have worked, and you are entitled to a copy of the OSHA 301 form for an
          incident involving you. These must be provided by the end of the next business day.
        </p>
        <p>
          Depending on where you live, you may also have rights to see the personal information
          held about you, ask for corrections, and be told how it is used. California employees
          have these rights under the CCPA as amended by the CPRA.
        </p>
        <p>
          To make a request, contact {COMPANY.contactEmail}. Ask for a correction the same way if
          anything here is wrong.
        </p>
      </Section>

      <Section heading="Changes to this notice">
        <p>
          This notice may be updated as the app changes. Material changes will be communicated
          through the app, and the date at the top will be revised.
        </p>
      </Section>

      <Section heading="Questions">
        <p>
          Contact {COMPANY.contactEmail} or write to {COMPANY.legalName}, {COMPANY.address}.
        </p>
      </Section>
    </LegalPage>
  );
}

export const getServerSideProps = loadCompanyProps;
