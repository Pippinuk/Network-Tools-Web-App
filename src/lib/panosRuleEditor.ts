import { PANOS_CSV_COLUMNS, PanosRule, parsePanosCsv } from './panosUtils';

export type PanosRuleDraft = Record<(typeof PANOS_CSV_COLUMNS)[number], string>;

export const createPanosRuleDraft = (): PanosRuleDraft => ({
  rule_name: '', description: '', tags: '', rule_type: 'universal',
  source_zone: 'any', source_address: 'any', source_user: 'any', source_hip: 'any',
  destination_zone: 'any', destination_address: 'any', destination_hip: 'any',
  application: 'any', service: 'application-default', url_category: 'any',
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

// Use the same normalization and defaults for manual entry and CSV import.
export const parsePanosRuleDraft = (draft: PanosRuleDraft) => parsePanosCsv(
  PANOS_CSV_COLUMNS.join(',') + '\n' + PANOS_CSV_COLUMNS.map(key =>
    `"${draft[key].replace(/"/g, '""')}"`
  ).join(',')
);