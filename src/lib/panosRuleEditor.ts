import { PANOS_CSV_COLUMNS, PanosRule, parsePanosCsv } from './panosUtils';

export type PanosRuleDraft = Record<(typeof PANOS_CSV_COLUMNS)[number], string>;

export const createPanosRuleDraft = (): PanosRuleDraft => ({
  rule_name: '', description: '', tags: '', rule_type: 'universal',
  source_zone: 'any', source_address: 'any', source_user: 'any', source_hip: 'any',
  destination_zone: 'any', destination_address: 'any', destination_hip: 'any',
  application: '', service: 'application-default', url_category: 'any',
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

// Require an explicit App-ID choice in the UI, then share CSV normalization.
export const parsePanosRuleDraft = (draft: PanosRuleDraft) => {
  if (!draft.application.trim()) {
    return { rules: [], errors: ['Enter Applications (App-ID); use “any” only if all applications are intentionally required.'] };
  }
  return parsePanosCsv(
  PANOS_CSV_COLUMNS.join(',') + '\n' + PANOS_CSV_COLUMNS.map(key =>
    `"${draft[key].replace(/"/g, '""')}"`
  ).join(',')
  );
};