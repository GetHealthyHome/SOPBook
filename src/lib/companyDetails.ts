/**
 * The company details that appear on the legal pages.
 *
 * These used to be constants in the source, which meant changing them took a
 * code edit and a deploy — so in practice they never changed, and employees
 * read "[CONTACT EMAIL]" on a live page. They are settings now.
 *
 * Two of them fall back to the OSHA establishment details, because for most
 * companies they are the same facts and nobody should have to type an address
 * twice. The fallback is only used when the legal-page field is left blank, so
 * a company whose mailing address differs from its establishment can still say
 * so.
 *
 * Resolution is pure and takes the settings bag, so every fallback path can be
 * tested without a database.
 */

export interface CompanyDetails {
  legalName: string;
  shortName: string;
  address: string;
  contactEmail: string;
  safetyContact: string;
}

/**
 * What a page shows when a detail has not been filled in.
 *
 * Deliberately conspicuous rather than blank or omitted: a legal page missing
 * its contact route is broken, and it should look broken to whoever spots it
 * first — including the admin who has not finished setup.
 */
export const PLACEHOLDERS = {
  legalName:     '[COMPANY LEGAL NAME — set this in Admin Console → Compliance]',
  address:       '[COMPANY MAILING ADDRESS — set this in Admin Console → Compliance]',
  contactEmail:  '[CONTACT EMAIL — set this in Admin Console → Compliance]',
  safetyContact: '[SAFETY CONTACT — set this in Admin Console → Compliance]',
} as const;

/** The settings an admin can fill in for these pages. */
export const COMPANY_SETTING_KEYS = [
  'company_legal_name',
  'company_short_name',
  'company_mailing_address',
  'company_contact_email',
  'company_safety_contact',
] as const;

const clean = (v: unknown) => String(v ?? '').trim();

/** Compose a one-line address from the OSHA establishment fields. */
function addressFromEstablishment(s: Record<string, string | undefined>): string {
  const street = clean(s.osha_establishment_street);
  const city   = clean(s.osha_establishment_city);
  const state  = clean(s.osha_establishment_state);
  const zip    = clean(s.osha_establishment_zip);
  // A partial address is worse than none — "…, OH" tells nobody where to write.
  if (!street || !city || !state) return '';
  return `${street}, ${city}, ${state}${zip ? ` ${zip}` : ''}`;
}

export function resolveCompany(settings: Record<string, string | undefined>): CompanyDetails {
  // The registered name is the same fact OSHA asks for, so reuse it rather
  // than making somebody enter it in two places.
  const legalName = clean(settings.company_legal_name)
    || clean(settings.osha_establishment_name)
    || PLACEHOLDERS.legalName;

  const address = clean(settings.company_mailing_address)
    || addressFromEstablishment(settings)
    || PLACEHOLDERS.address;

  return {
    legalName,
    // What employees call the company day to day. Falls back to the legal
    // name, which reads fine in a sentence even when it carries an "LLC".
    shortName:     clean(settings.company_short_name) || legalName,
    address,
    contactEmail:  clean(settings.company_contact_email)  || PLACEHOLDERS.contactEmail,
    safetyContact: clean(settings.company_safety_contact) || PLACEHOLDERS.safetyContact,
  };
}

/** True while any detail is still showing a placeholder. */
export function hasUnsetDetails(c: CompanyDetails): boolean {
  return Object.values(c).some(v => v.startsWith('['));
}
