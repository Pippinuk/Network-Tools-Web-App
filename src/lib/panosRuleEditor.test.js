import { describe, test, expect } from 'bun:test';
import { createPanosRuleDraft, getPanosFieldWarning, parsePanosRuleDraft, ruleToDraft } from './panosRuleEditor';
import { parsePanosCsv, generatePanosCsvTemplate, generateBulkXml, generateRestApiCommands, generateTerraform, generateXmlApiCommands } from './panosUtils';

const options = { target: 'panorama', host: 'panorama.example.com', deviceGroup: 'Branch', rulebase: 'pre-rulebase', vsys: 'vsys1', apiKeyPlaceholder: '{api_key}' };

describe('PAN-OS rule defaults', () => {
  for (const field of ['negate_destination', 'negate_source', 'disabled']) {
    test(`${field} defaults to no in UI and CSV unless changed`, () => {
      const draft = { ...createPanosRuleDraft(), rule_name: 'My-Rule', application: 'ssl' };
      expect(draft[field]).toBe('no');
      expect(parsePanosRuleDraft(draft).rules[0][field]).toBe(false);
      expect(parsePanosCsv('rule_name\nMy-Rule').rules[0][field]).toBe(false);
      expect(parsePanosRuleDraft({ ...draft, [field]: 'yes' }).rules[0][field]).toBe(true);
      expect(parsePanosCsv(`rule_name,${field}\nMy-Rule,yes`).rules[0][field]).toBe(true);
      expect(parsePanosCsv(generatePanosCsvTemplate()).rules.every(rule => !rule[field])).toBe(true);
    });
  }
  test('schedule defaults to any, with named schedules preserved', () => {
    const draft = { ...createPanosRuleDraft(), rule_name: 'My-Rule', application: 'ssl' };
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
    const result = parsePanosRuleDraft({ ...createPanosRuleDraft(), rule_name: 'User-Rule', application: 'ssl;dns' });
    expect(result.rules).toHaveLength(1);
    for (const output of [generateBulkXml(result.rules), generateXmlApiCommands(result.rules, options), generateRestApiCommands(result.rules, options), generateTerraform(result.rules, options)]) {
      expect(output).toContain('User-Rule');
      expect(output).not.toContain('Example-Allow-Web');
    }
  });
  test('edit round trip preserves every rule field', () => {
    const result = parsePanosRuleDraft({ ...createPanosRuleDraft(), rule_name: 'Quoted-Rule', description: 'Text, with "quotes"', application: 'ssl;dns', disabled: 'yes', tags: 'one;two' });
    expect(result.errors).toEqual([]);
    expect(parsePanosRuleDraft(ruleToDraft(result.rules[0])).rules[0]).toEqual(result.rules[0]);
  });
});

describe('PAN-OS UI safety checks', () => {
  test('App-ID starts blank and cannot implicitly become any on save', () => {
    expect(createPanosRuleDraft().application).toBe('');
    for (const application of ['', '   ']) {
      const result = parsePanosRuleDraft({ ...createPanosRuleDraft(), rule_name: 'Explicit-App', application });
      expect(result.rules).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    }
    expect(parsePanosRuleDraft({ ...createPanosRuleDraft(), rule_name: 'Explicit-App', application: 'ssl' }).rules[0].application).toEqual(['ssl']);
  });
  for (const field of ['application', 'source_zone', 'source_address', 'destination_zone', 'destination_address']) {
    test(`${field} warns for any but allows intentional broad rules`, () => {
      expect(getPanosFieldWarning(field, 'any')).toBeDefined();
      expect(getPanosFieldWarning(field, ' Any ')).toBeDefined();
      expect(getPanosFieldWarning(field, 'specific; ANY ')).toBeDefined();
      expect(getPanosFieldWarning(field, 'specific')).toBeUndefined();
      expect(getPanosFieldWarning(field, 'company-network')).toBeUndefined();
      expect(getPanosFieldWarning(field, '')).toBeUndefined();
      const result = parsePanosRuleDraft({ ...createPanosRuleDraft(), rule_name: 'Intentional-Any', application: 'ssl', [field]: 'any' });
      expect(result.errors).toEqual([]);
      expect(result.rules[0][field]).toEqual(['any']);
    });
  }
  test('unrequested any fields do not trigger broad-scope warnings', () => {
    expect(getPanosFieldWarning('schedule', 'any')).toBeUndefined();
    expect(getPanosFieldWarning('source_user', 'any')).toBeUndefined();
  });
});