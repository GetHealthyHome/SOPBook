import Link from 'next/link';
import { LegalPage, Section, Bullets, Note, COMPANY } from '@/lib/legal';

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Use"
      intro={`The Healthy Home Field Guide is a work tool provided by ${COMPANY.legalName} to its employees and authorised contractors. These terms cover how it may be used. Using it means accepting them.`}
    >
      <Section heading="Who this is for">
        <p>
          The Field Guide is for people who work for {COMPANY.shortName}. It is not a public
          service. Access is granted by an administrator and can be withdrawn at any time —
          when someone leaves, changes role, or misuses it.
        </p>
      </Section>

      <Section heading="Your account">
        <Bullets items={[
          <>Your sign-in is personal to you. Do not share your password or let anyone else use your account, including a co-worker who is &ldquo;just checking one thing&rdquo;.</>,
          <>Everything done under your account is attributed to you — including sign-offs, acknowledgements, edits and incident reports.</>,
          <>If you think someone else knows your password, change it and tell an administrator the same day.</>,
          <>Administrators can reset your password but cannot read it. Passwords are stored one-way and cannot be recovered by anyone.</>,
        ]} />
      </Section>

      <Section heading="Procedures, sign-offs and what they mean">
        <p>
          When you sign off an SOP or acknowledge a handbook section, you are creating a record
          that you read it at that version. That record is kept, is visible to administrators,
          and may be used to show that training and procedures were communicated.
        </p>
        <Bullets items={[
          <>Do not sign off on something you have not read.</>,
          <>When a procedure is revised, your previous sign-off no longer counts. You will be asked to read and sign off the new version.</>,
          <>If a procedure looks wrong, unsafe, or out of date, say so rather than following it. Use the suggestion feature or tell a supervisor.</>,
        ]} />
      </Section>

      <Section heading="Working offline">
        <p>
          The Field Guide keeps a copy of recent procedures on your device so it still works in a
          basement, an attic, or anywhere with no signal. That copy can be out of date.
        </p>
        <Note>
          Before doing anything safety-critical from an offline copy, get signal and let the app
          refresh. A cached procedure will not tell you it has been superseded.
        </Note>
      </Section>

      <Section heading="Incident reports">
        <Bullets items={[
          <>Report incidents promptly and truthfully, including near misses and damage to a customer&rsquo;s home.</>,
          <>Do not guess at medical details or diagnose anyone. Record what you observed.</>,
          <>Filing a report in good faith is expected and protected. Retaliating against someone for filing one is prohibited — see <Link href="/rights" className="text-emerald-700 font-bold underline">Your Safety Rights</Link>.</>,
        ]} />
      </Section>

      <Section heading="Customer information and photos">
        <Bullets items={[
          <>Job details, addresses and customer information in this app are confidential. Do not share them outside {COMPANY.shortName}.</>,
          <>Photos uploaded here are work records. Take them for a work reason, and avoid capturing more of a customer&rsquo;s home or belongings than the job requires.</>,
          <>Do not upload photos of people who have not agreed to it, except where an injury or damage record genuinely requires it.</>,
          <>Do not copy content out of the Field Guide to personal devices, accounts or social media.</>,
        ]} />
      </Section>

      <Section heading="Acceptable use">
        <p>Do not use the Field Guide to:</p>
        <Bullets items={[
          <>Access anything you have not been given access to, or attempt to work around access controls.</>,
          <>Post anything abusive, harassing or discriminatory.</>,
          <>Store personal material unrelated to work.</>,
          <>Falsify a record — a sign-off, a completion, an incident report or a certification.</>,
        ]} />
      </Section>

      <Section heading="Activity is recorded">
        <p>
          The Field Guide keeps records of what you read and acknowledge, what training you
          complete, and what you submit. This is how compliance is demonstrated, not a way of
          watching people. What is recorded, and who can see it, is set out in the{' '}
          <Link href="/privacy" className="text-emerald-700 font-bold underline">Privacy Notice</Link>.
        </p>
      </Section>

      <Section heading="Availability">
        <p>
          The Field Guide is provided as it is. It may be unavailable during maintenance, an
          outage at a service it depends on, or a loss of signal. It is a reference tool and does
          not replace training, supervision, judgement, or the requirement to stop work when
          something is unsafe.
        </p>
      </Section>

      <Section heading="Changes to these terms">
        <p>
          These terms may be updated. Material changes will be communicated through the app.
          Continuing to use the Field Guide after a change means accepting the updated terms.
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
