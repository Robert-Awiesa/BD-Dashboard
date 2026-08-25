/**
 * Reading a spreadsheet somebody actually made.
 *
 * The outreach importer matched headers against the literal strings 'Name' and
 * 'name'. A sheet with "NAME", "Name " or "Full Name" produced "row 2: name is
 * required" for every row — the file uploaded fine, nothing landed, and the
 * error blamed the data rather than the header.
 *
 * People do not retype their contact list to match our template. They export it
 * from Outlook, or they have kept it in a sheet for two years. So headers are
 * matched on their letters and digits alone, against a list of the words people
 * actually use, and anything unrecognised is reported by name rather than
 * silently dropped.
 */

/** Letters and digits only: "Full Name " and "full-name" both become "fullname". */
export const canon = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Build a row mapper from { field: [aliases…] }.
 *
 * Returns { map, unknownHeaders } where `map(row)` gives an object keyed by
 * your field names, and `unknownHeaders` names the columns nothing matched so
 * the UI can say what it ignored.
 */
export const makeRowMapper = (aliases) => {
  const lookup = new Map();
  for (const [field, names] of Object.entries(aliases)) {
    // The field's own name always matches, so a sheet exported from our own
    // API round-trips without needing an alias entry.
    for (const name of [field, ...names]) lookup.set(canon(name), field);
  }

  const unknown = new Set();

  const map = (row) => {
    const out = {};
    for (const [header, value] of Object.entries(row)) {
      const field = lookup.get(canon(header));
      if (!field) {
        if (canon(header)) unknown.add(String(header).trim());
        continue;
      }
      // First column wins, so a sheet with both "Email" and "E-mail" does not
      // have the filled one overwritten by the empty one.
      if (out[field]) continue;
      // Everything becomes a string: a phone number or a postcode arrives from
      // the sheet as a number, and every field downstream is text.
      out[field] = value === null || value === undefined ? '' : String(value).trim();
    }
    return out;
  };

  return { map, unknownHeaders: () => [...unknown] };
};

/** The words people actually put at the top of a column. */
export const PERSON_ALIASES = {
  name: ['name', 'full name', 'fullname', 'contact name', 'contact person', 'person', 'recipient'],
  title: ['title', 'role', 'position', 'job title', 'designation'],
  email: ['email', 'e-mail', 'email address', 'mail', 'work email'],
  contact: ['contact', 'phone', 'phone contact', 'phone number', 'mobile', 'telephone', 'tel', 'cell'],
  company: ['company', 'organisation', 'organization', 'business', 'employer', 'client'],
  notes: ['notes', 'note', 'message', 'details', 'comment', 'comments', 'remarks'],
};

/** Prospecting leads. Same idea: the words a real list uses, not our labels. */
export const LEAD_ALIASES = {
  company: ['company', 'company name', 'organisation', 'organization', 'business', 'account'],
  industry: ['industry', 'sector', 'vertical'],
  customIndustry: ['custom industry', 'custom industry (if others)', 'other industry', 'industry other'],
  contactPerson: ['contact person', 'contact', 'name', 'full name', 'contact name', 'person'],
  position: ['position', 'job title', 'title', 'role', 'designation'],
  companyChallenge: ['company challenge', 'challenge', 'pain point', 'problem'],
  proposedSolution: ['proposed solution', 'solution', 'proposal'],
  strategicAngle: ['strategic angle', 'angle', 'strategy'],
  opportunityStage: ['opportunity stage', 'stage', 'status'],
  primaryEmail: ['primary email', 'email', 'e-mail', 'email address', 'work email', 'mail'],
  otherEmail: ['other email', 'secondary email', 'alt email', 'alternate email'],
  primaryContact: ['primary contact', 'phone', 'phone number', 'mobile', 'telephone', 'tel', 'cell', 'contact number'],
  otherContact: ['other contact', 'secondary phone', 'alt phone', 'alternate phone'],
  linkedin: ['linkedin', 'linked in', 'linkedin url', 'linkedin profile'],
  companyWebsite: ['company website', 'website', 'web', 'url', 'site'],
  location: ['location', 'city', 'region', 'country', 'address'],
  discoveryQuestions: ['discovery questions', 'questions', 'discovery'],
};

/**
 * One sentence a person can act on. "Imported 0" on its own does not say
 * whether the file was wrong, the columns were wrong, or the rows were empty.
 */
export const importSummary = ({
  imported = 0,
  skipped = 0,
  blocked = 0,
  errors = [],
  unknownHeaders = [],
}) => {
  const parts = [`Imported ${imported}`];
  // Two different reasons a row did not land, and saying "already on the list"
  // about a row that was missing a required field is simply wrong.
  if (skipped) parts.push(`skipped ${skipped} already on the list`);
  const unusable = blocked + errors.length;
  if (unusable) parts.push(`${unusable} row(s) could not be used`);
  if (unknownHeaders.length) {
    parts.push(`ignored column(s): ${unknownHeaders.join(', ')}`);
  }
  return `${parts.join(' · ')}.`;
};
