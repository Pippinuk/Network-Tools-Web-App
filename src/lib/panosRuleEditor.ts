import { PANOS_CSV_COLUMNS, PanosRule, parsePanosCsv } from './panosUtils';

export type PanosRuleDraft = Record<(typeof PANOS_CSV_COLUMNS)[number], string>;

/** Fields where a blank value still means "any": the UI shows "any" as a greyed hint instead of a value. */
export const PANOS_ANY_HINT_FIELDS: (keyof PanosRuleDraft)[] = [
  'source_zone', 'source_address', 'source_user', 'source_hip',
  'destination_zone', 'destination_address', 'destination_hip', 'url_category',
];

/** Fields the UI needs an explicit entry for before a rule can be added. */
export const PANOS_REQUIRED_FIELDS: (keyof PanosRuleDraft)[] = [
  'rule_name', 'source_zone', 'source_address', 'destination_zone', 'destination_address', 'application',
];

export const createPanosRuleDraft = (): PanosRuleDraft => ({
  rule_name: '', description: '', tags: '', rule_type: 'universal',
  source_zone: '', source_address: '', source_user: '', source_hip: '',
  destination_zone: '', destination_address: '', destination_hip: '',
  application: '', service: 'application-default', url_category: '',
  action: 'allow', profile_group: '', log_start: 'no', log_end: 'yes',
  log_setting: '', schedule: 'any', disabled: 'no', negate_source: 'no', negate_destination: 'no',
});

export const ruleToDraft = (rule: PanosRule): PanosRuleDraft => {
  const draft = createPanosRuleDraft();
  for (const key of PANOS_CSV_COLUMNS) {
    const value = rule[key];
    draft[key] = Array.isArray(value) ? value.join(';') : typeof value === 'boolean' ? (value ? 'yes' : 'no') : value;
  }
  return draft;
};

const anyWarnings: Partial<Record<keyof PanosRuleDraft, string>> = {
  application: '“any” matches all applications. Specify App-IDs to limit the rule to the applications you need.',
  source_zone: '“any” matches all source zones. Specify the intended source zones to limit the rule’s scope.',
  source_address: '“any” matches all source addresses. Specify the intended hosts or networks where possible.',
  destination_zone: '“any” matches all destination zones. Specify the intended destination zones to limit the rule’s scope.',
  destination_address: '“any” matches all destination addresses. Specify the intended hosts or networks where possible.',
};

export const getPanosFieldWarning = (key: keyof PanosRuleDraft, value: string): string | undefined =>
  value.split(';').some(member => member.trim().toLowerCase() === 'any') ? anyWarnings[key] : undefined;

const requiredMessages: Partial<Record<keyof PanosRuleDraft, string>> = {
  rule_name: 'Enter a rule name.',
  source_zone: 'Enter the source zones, or type “any” to match every zone.',
  source_address: 'Enter the source addresses, or type “any” to match every source.',
  destination_zone: 'Enter the destination zones, or type “any” to match every zone.',
  destination_address: 'Enter the destination addresses, or type “any” to match every destination.',
  application: 'Enter Applications (App-ID), or type “any” only if all applications are intentionally required.',
};

// Require explicit entries for the broad-scope fields, then share CSV normalization.
export const parsePanosRuleDraft = (draft: PanosRuleDraft) => {
  const missing = PANOS_REQUIRED_FIELDS
    .filter(key => !draft[key].trim())
    .map(key => requiredMessages[key] ?? `Enter a value for ${key}.`);
  if (missing.length > 0) {
    return { rules: [] as PanosRule[], errors: missing };
  }
  return parsePanosCsv(
    PANOS_CSV_COLUMNS.join(',') + '\n' + PANOS_CSV_COLUMNS.map(key =>
      `"${draft[key].replace(/"/g, '""')}"`
    ).join(',')
  );
};
