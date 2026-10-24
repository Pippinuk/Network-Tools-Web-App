import { describe, test, expect } from 'bun:test';
import { createPanosRuleDraft, getPanosFieldWarning, parsePanosRuleDraft, ruleToDraft, PANOS_ANY_HINT_FIELDS, PANOS_REQUIRED_FIELDS } from './panosRuleEditor';
import { parsePanosCsv, generatePanosCsvTemplate, generateBulkXml, generateRestApiCommands, generateTerraform, generateXmlApiCommands } from './panosUtils';

const options = { target: 'panorama', host: 'panorama.example.com', deviceGroup: 'Branch', rulebase: 'pre-rulebase', vsys: 'vsys1', apiKeyPlaceholder: '{api_key}' };

// A draft with every UI-required field filled in.
const baseDraft = (overrides = {}) => ({
  ...createPanosRuleDraft(),
  rule_name: 'My-Rule',
  source_zone: 'Trust',
  source_address: 'Corp-Users-Net',
  destination_zone: 'Untrust',
  destination_address: 'any',
  application: 'ssl',
  ...overrides,
});

describe('PAN-OS rule defaults', () => {
  for (const field of ['negate_destination', 'negate_source', 'disabled']) {
    test(`${field} defaults to no in UI and CSV unless changed`, () => {
      const draft = baseDraft();
      expect(draft[field]).toBe('no');
      expect(parsePanosRuleDraft(draft).rules[0][field]).toBe(false);
      expect(parsePanosCsv('rule_name\nMy-Rule').rules[0][field]).toBe(false);
      expect(parsePanosRuleDraft({ ...draft, [field]: 'yes' }).rules[0][field]).toBe(true);
      expect(parsePanosCsv(`rule_name,${field}\nMy-Rule,yes`).rules[0][field]).toBe(true);
      expect(parsePanosCsv(generatePanosCsvTemplate()).rules.every(rule => !rule[field])).toBe(true);
    });
  }
  test('schedule defaults to any, with named schedules preserved', () => {
    const draft = baseDraft();
    expect(draft.schedule).toBe('any');
    expect(parsePanosRuleDraft(draft).rules[0].schedule).toBe('any');
    expect(parsePanosCsv('rule_name\nMy-Rule').rules[0].schedule).toBe('any');
    expect(parsePanosCsv('rule_name,schedule\nMy-Rule,').rules[0].schedule).toBe('any');
    expect(parsePanosRuleDraft({ ...draft, schedule: 'Business-Hours' }).rules[0].schedule).toBe('Business-Hours');
    expect(parsePanosCsv(generatePanosCsvTemplate()).rules.every(rule => rule.schedule === 'any')).toBe(true);
  });
  test('only explicitly authored rules enter every output format', () => {
    expect(createPanosRuleDraft().rule_name).toBe('');
    expect(parsePanosRuleDraft(createPanosRuleDraft()).rules).toHaveLength(0);
    const result = parsePanosRuleDraft(baseDraft({ rule_name: 'User-Rule', application: 'ssl;dns' }));
    expect(result.rules).toHaveLength(1);
    for (const output of [generateBulkXml(result.rules), generateXmlApiCommands(result.rules, options), generateRestApiCommands(result.rules, options), generateTerraform(result.rules, options)]) {
      expect(output).toContain('User-Rule');
      expect(output).not.toContain('Example-Allow-Web');
    }
  });
  test('edit round trip preserves every rule field', () => {
    const result = parsePanosRuleDraft(baseDraft({ rule_name: 'Quoted-Rule', description: 'Text, with "quotes"', application: 'ssl;dns', disabled: 'yes', tags: 'one;two' }));
    expect(result.errors).toEqual([]);
    expect(parsePanosRuleDraft(ruleToDraft(result.rules[0])).rules[0]).toEqual(result.rules[0]);
  });
});

describe('PAN-OS UI safety checks', () => {
  test('App-ID starts blank and cannot implicitly become any on save', () => {
    expect(createPanosRuleDraft().application).toBe('');
    for (const application of ['', '   ']) {
      const result = parsePanosRuleDraft(baseDraft({ application }));
      expect(result.rules).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    }
    expect(parsePanosRuleDraft(baseDraft({ application: 'ssl' })).rules[0].application).toEqual(['ssl']);
  });
  test('broad-scope fields start blank so the UI can show a greyed any hint', () => {
    const draft = createPanosRuleDraft();
    for (const field of PANOS_ANY_HINT_FIELDS) {
      expect(draft[field]).toBe('');
    }
    expect(draft.application).toBe('');
  });
  test('blank zones and addresses block the rule and say how to allow everything', () => {
    const result = parsePanosRuleDraft({ ...createPanosRuleDraft(), rule_name: 'Missing-Zones', application: 'ssl' });
    expect(result.rules).toHaveLength(0);
    expect(result.errors).toEqual([
      'Enter the source zones, or type “any” to match every zone.',
      'Enter the source addresses, or type “any” to match every source.',
      'Enter the destination zones, or type “any” to match every zone.',
      'Enter the destination addresses, or type “any” to match every destination.',
    ]);
  });
  test('blank optional fields still emit any in the generated rule', () => {
    const rule = parsePanosRuleDraft(baseDraft()).rules[0];
    expect(rule.source_user).toEqual(['any']);
    expect(rule.source_hip).toEqual(['any']);
    expect(rule.destination_hip).toEqual(['any']);
    expect(rule.url_category).toEqual(['any']);
  });
  test('the UI asks for the warned fields to be filled in', () => {
    expect(PANOS_REQUIRED_FIELDS).toEqual(['rule_name', 'source_zone', 'source_address', 'destination_zone', 'destination_address', 'application']);
  });
  for (const field of ['application', 'source_zone', 'source_address', 'destination_zone', 'destination_address']) {
    test(`${field} warns for any but allows intentional broad rules`, () => {
      expect(getPanosFieldWarning(field, 'any')).toBeDefined();
      expect(getPanosFieldWarning(field, ' Any ')).toBeDefined();
      expect(getPanosFieldWarning(field, 'specific; ANY ')).toBeDefined();
      expect(getPanosFieldWarning(field, 'specific')).toBeUndefined();
      expect(getPanosFieldWarning(field, 'company-network')).toBeUndefined();
      expect(getPanosFieldWarning(field, '')).toBeUndefined();
      const result = parsePanosRuleDraft(baseDraft({ rule_name: 'Intentional-Any', [field]: 'any' }));
      expect(result.errors).toEqual([]);
      expect(result.rules[0][field]).toEqual(['any']);
    });
  }
  test('unrequested any fields do not trigger broad-scope warnings', () => {
    expect(getPanosFieldWarning('schedule', 'any')).toBeUndefined();
    expect(getPanosFieldWarning('source_user', 'any')).toBeUndefined();
  });
});
