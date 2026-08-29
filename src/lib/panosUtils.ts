/**
 * Palo Alto PAN-OS / Panorama security policy utilities
 * Converts CSV rule definitions into API commands (XML API + REST API).
 */

export interface PanosRule {
  rule_name: string;
  description: string;
  tags: string[];
  rule_type: string; // universal | interzone | intrazone
  source_zone: string[];
  source_address: string[];
  source_user: string[];
  source_hip: string[];
  destination_zone: string[];
  destination_address: string[];
  destination_hip: string[];
  application: string[];
  service: string[];
  url_category: string[];
  action: string; // allow | deny | drop | reset-client | reset-server | reset-both
  profile_group: string;
  log_start: boolean;
  log_end: boolean;
  log_setting: string;
  schedule: string;
  disabled: boolean;
  negate_source: boolean;
  negate_destination: boolean;
}

export interface PanosTargetOptions {
  /** 'panorama' or 'firewall' */
  target: 'panorama' | 'firewall';
  host: string;
  deviceGroup: string;
  rulebase: 'pre-rulebase' | 'post-rulebase';
  vsys: string;
  apiKeyPlaceholder: string;
}

export type PanosPlacementMode = 'none' | 'top' | 'bottom' | 'after';

export interface PanosPlacement {
  mode: PanosPlacementMode;
  /** Existing rule name that new rules are placed after (mode = 'after') */
  afterRule: string;
}

export const PANOS_CSV_COLUMNS = [
  'rule_name',
  'description',
  'tags',
  'rule_type',
  'source_zone',
  'source_address',
  'source_user',
  'source_hip',
  'destination_zone',
  'destination_address',
  'destination_hip',
  'application',
  'service',
  'url_category',
  'action',
  'profile_group',
  'log_start',
  'log_end',
  'log_setting',
  'schedule',
  'disabled',
  'negate_source',
  'negate_destination',
] as const;

const EXAMPLE_ROWS: string[][] = [
  [
    'Allow-Web-Browsing',
    'Corporate users to internet web browsing',
    'internet;approved',
    'universal',
    'Trust',
    'Corp-Users-Net',
    'any',
    'any',
    'Untrust',
    'any',
    'any',
    'web-browsing;ssl;dns',
    'application-default',
    'any',
    'allow',
    'Outbound-Security-Profiles',
    'no',
    'yes',
    'default-log-profile',
    'any',
    'no',
    'no',
    'no',
  ],
  [
    'Allow-O365',
    'Microsoft 365 SaaS access',
    'saas',
    'universal',
    'Trust',
    'any',
    'any',
    'any',
    'Untrust',
    'any',
    'any',
    'ms-office365;ms-onedrive;ms-teams',
    'application-default',
    'any',
    'allow',
    'Outbound-Security-Profiles',
    'no',
    'yes',
    '',
    'any',
    'no',
    'no',
    'no',
  ],
  [
    'Block-Risky-Apps',
    'Block P2P and proxy avoidance applications',
    'blocked',
    'universal',
    'Trust',
    'any',
    'any',
    'any',
    'Untrust',
    'any',
    'any',
    'bittorrent;tor;ultrasurf',
    'any',
    'any',
    'deny',
    '',
    'yes',
    'yes',
    '',
    'any',
    'no',
    'no',
    'no',
  ],
];

export const generatePanosCsvTemplate = (): string => {
  const lines = [PANOS_CSV_COLUMNS.join(',')];
  EXAMPLE_ROWS.forEach((row) => lines.push(row.map(csvCell).join(',')));
  return lines.join('\n');
};

const csvCell = (value: string): string =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** Parse a CSV string into rows, honouring quoted fields */
const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
};

const splitList = (value: string, fallback = 'any'): string[] => {
  const parts = (value || '')
    .split(/[;|]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.length > 0 ? parts : fallback ? [fallback] : [];
};

const toBool = (value: string, fallback = false): boolean => {
  const v = (value || '').trim().toLowerCase();
  if (!v) return fallback;
  return ['yes', 'y', 'true', '1', 'enabled', 'enable'].includes(v);
};

export interface PanosParseResult {
  rules: PanosRule[];
  errors: string[];
}

export const parsePanosCsv = (text: string): PanosParseResult => {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (rows.length === 0) {
    return { rules: [], errors: ['The CSV file appears to be empty.'] };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const idx = (name: string) => header.indexOf(name);
  if (idx('rule_name') === -1) {
    return {
      rules: [],
      errors: ['Missing required column "rule_name". Download the template for the expected format.'],
    };
  }

  const get = (row: string[], name: string): string => {
    const i = idx(name);
    return i === -1 ? '' : (row[i] ?? '').trim();
  };

  const rules: PanosRule[] = [];
  rows.slice(1).forEach((row, n) => {
    const lineNo = n + 2;
    const name = get(row, 'rule_name');
    if (!name) {
      errors.push(`Line ${lineNo}: rule_name is required — row skipped.`);
      return;
    }
    const action = (get(row, 'action') || 'allow').toLowerCase();
    const validActions = ['allow', 'deny', 'drop', 'reset-client', 'reset-server', 'reset-both'];
    if (!validActions.includes(action)) {
      errors.push(`Line ${lineNo}: unknown action "${action}" — defaulting to "deny".`);
    }
    const ruleType = (get(row, 'rule_type') || 'universal').toLowerCase();
    if (!['universal', 'interzone', 'intrazone'].includes(ruleType)) {
      errors.push(`Line ${lineNo}: unknown rule_type "${ruleType}" — defaulting to "universal".`);
    }

    rules.push({
      rule_name: name,
      description: get(row, 'description'),
      tags: splitList(get(row, 'tags'), ''),
      rule_type: ['universal', 'interzone', 'intrazone'].includes(ruleType) ? ruleType : 'universal',
      source_zone: splitList(get(row, 'source_zone')),
      source_address: splitList(get(row, 'source_address')),
      source_user: splitList(get(row, 'source_user')),
      source_hip: splitList(get(row, 'source_hip')),
      destination_zone: splitList(get(row, 'destination_zone')),
      destination_address: splitList(get(row, 'destination_address')),
      destination_hip: splitList(get(row, 'destination_hip')),
      application: splitList(get(row, 'application')),
      service: splitList(get(row, 'service'), 'application-default'),
      url_category: splitList(get(row, 'url_category')),
      action: validActions.includes(action) ? action : 'deny',
      profile_group: get(row, 'profile_group'),
      log_start: toBool(get(row, 'log_start'), false),
      log_end: toBool(get(row, 'log_end'), true),
      log_setting: get(row, 'log_setting'),
      schedule: get(row, 'schedule'),
      disabled: toBool(get(row, 'disabled'), false),
      negate_source: toBool(get(row, 'negate_source'), false),
      negate_destination: toBool(get(row, 'negate_destination'), false),
    });
  });

  return { rules, errors };
};

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const members = (list: string[]): string =>
  list.map((m) => `<member>${esc(m)}</member>`).join('');

/** Build the <entry> XML element for a security rule */
export const ruleToXml = (rule: PanosRule): string => {
  let xml = `<entry name="${esc(rule.rule_name)}">`;
  xml += `<from>${members(rule.source_zone)}</from>`;
  xml += `<to>${members(rule.destination_zone)}</to>`;
  xml += `<source>${members(rule.source_address)}</source>`;
  xml += `<destination>${members(rule.destination_address)}</destination>`;
  xml += `<source-user>${members(rule.source_user)}</source-user>`;
  xml += `<source-hip>${members(rule.source_hip)}</source-hip>`;
  xml += `<destination-hip>${members(rule.destination_hip)}</destination-hip>`;
  xml += `<application>${members(rule.application)}</application>`;
  xml += `<service>${members(rule.service)}</service>`;
  xml += `<category>${members(rule.url_category)}</category>`;
  xml += `<action>${esc(rule.action)}</action>`;
  xml += `<rule-type>${esc(rule.rule_type)}</rule-type>`;
  if (rule.description) xml += `<description>${esc(rule.description)}</description>`;
  if (rule.tags.length) xml += `<tag>${members(rule.tags)}</tag>`;
  if (rule.profile_group)
    xml += `<profile-setting><group><member>${esc(rule.profile_group)}</member></group></profile-setting>`;
  if (rule.log_setting) xml += `<log-setting>${esc(rule.log_setting)}</log-setting>`;
  xml += `<log-start>${rule.log_start ? 'yes' : 'no'}</log-start>`;
  xml += `<log-end>${rule.log_end ? 'yes' : 'no'}</log-end>`;
  if (rule.schedule && rule.schedule.toLowerCase() !== 'any')
    xml += `<schedule>${esc(rule.schedule)}</schedule>`;
  if (rule.negate_source) xml += `<negate-source>yes</negate-source>`;
  if (rule.negate_destination) xml += `<negate-destination>yes</negate-destination>`;
  xml += `<disabled>${rule.disabled ? 'yes' : 'no'}</disabled>`;
  xml += `</entry>`;
  return xml;
};

const xpathFor = (opts: PanosTargetOptions, ruleName: string): string => {
  if (opts.target === 'panorama') {
    return `/config/devices/entry[@name='localhost.localdomain']/device-group/entry[@name='${opts.deviceGroup}']/${opts.rulebase}/security/rules/entry[@name='${ruleName}']`;
  }
  return `/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='${opts.vsys}']/rulebase/security/rules/entry[@name='${ruleName}']`;
};

/** XML API op command to move a rule to a position in the rulebase */
const moveRuleCmd = (ruleName: string, opts: PanosTargetOptions, placement: PanosPlacement): string => {
  const xpath = xpathFor(opts, ruleName);
  const where = placement.mode === 'after' ? 'after' : placement.mode; // top | bottom | after
  const dst =
    placement.mode === 'after' ? `<dst>${esc(placement.afterRule)}</dst>` : '';
  return (
    `<request><security-policy><move>` +
    `<xpath>${esc(xpath)}</xpath>` +
    `<where>${where}</where>${dst}` +
    `</move></security-policy></request>`
  );
};

/** XML API (type=config&action=set) curl commands */
export const generateXmlApiCommands = (
  rules: PanosRule[],
  opts: PanosTargetOptions,
  placement: PanosPlacement = { mode: 'none', afterRule: '' }
): string => {
  const host = opts.host || '{firewall}';
  let out = '# Palo Alto PAN-OS XML API - Security Policy Rules\n';
  out += `# Target: ${opts.target === 'panorama' ? `Panorama, device-group "${opts.deviceGroup}" (${opts.rulebase})` : `Firewall, vsys "${opts.vsys}"`}\n`;
  out += `# Generated: ${new Date().toISOString()}\n`;
  out += `# Replace ${opts.apiKeyPlaceholder} with a valid API key (see notes at the end).\n\n`;

  rules.forEach((rule, i) => {
    out += `# ---- Rule ${i + 1}: ${rule.rule_name} ----\n`;
    out += `curl -k -X POST "https://${host}/api/" \\\n`;
    out += `  --data-urlencode "type=config" \\\n`;
    out += `  --data-urlencode "action=set" \\\n`;
    out += `  --data-urlencode "key=${opts.apiKeyPlaceholder}" \\\n`;
    out += `  --data-urlencode "xpath=${xpathFor(opts, rule.rule_name)}" \\\n`;
    out += `  --data-urlencode "element=${ruleToXml(rule)}"\n\n`;
  });

  const effectivePlacement: PanosPlacement =
    placement.mode === 'after' && !placement.afterRule
      ? { mode: 'none', afterRule: '' }
      : placement;

  if (effectivePlacement.mode !== 'none') {
    const describe =
      effectivePlacement.mode === 'after'
        ? `after rule "${effectivePlacement.afterRule}"`
        : `at the ${effectivePlacement.mode} of the rulebase`;
    out += `# ---- Rule placement: move all new rules ${describe} ----\n`;
    // Move in reverse order when chaining "after" the same anchor so the
    // final order matches the CSV order.
    const ordered = effectivePlacement.mode === 'after' ? [...rules].reverse() : rules;
    ordered.forEach((rule) => {
      out += `curl -k -X POST "https://${host}/api/" \\\n`;
      out += `  --data-urlencode "type=op" \\\n`;
      out += `  --data-urlencode "key=${opts.apiKeyPlaceholder}" \\\n`;
      out += `  --data-urlencode "cmd=${moveRuleCmd(rule.rule_name, opts, effectivePlacement)}"\n\n`;
    });
  }

  out += '# ---- Commit ----\n';
  out += `curl -k -X POST "https://${host}/api/" \\\n`;
  out += `  --data-urlencode "type=commit" \\\n`;
  out += `  --data-urlencode "key=${opts.apiKeyPlaceholder}" \\\n`;
  out += `  --data-urlencode "cmd=<commit></commit>"\n`;
  if (opts.target === 'panorama') {
    out += '\n# ---- Push to devices in the device group ----\n';
    out += `curl -k -X POST "https://${host}/api/" \\\n`;
    out += `  --data-urlencode "type=commit" \\\n`;
    out += `  --data-urlencode "action=all" \\\n`;
    out += `  --data-urlencode "key=${opts.apiKeyPlaceholder}" \\\n`;
    out += `  --data-urlencode "cmd=<commit-all><shared-policy><device-group><entry name='${opts.deviceGroup}'/></device-group></shared-policy></commit-all>"\n`;
  }
  out += '\n# Notes:\n';
  out += '# 1. Generate an API key: curl -k -X POST "https://<host>/api/?type=keygen&user=<user>&password=<pass>"\n';
  out += '# 2. Review the rules in the candidate configuration before committing.\n';
  return out;
};

const ruleToRestJson = (rule: PanosRule) => {
  const m = (list: string[]) => ({ member: list });
  const entry: Record<string, unknown> = {
    '@name': rule.rule_name,
    from: m(rule.source_zone),
    to: m(rule.destination_zone),
    source: m(rule.source_address),
    destination: m(rule.destination_address),
    'source-user': m(rule.source_user),
    'source-hip': m(rule.source_hip),
    'destination-hip': m(rule.destination_hip),
    application: m(rule.application),
    service: m(rule.service),
    category: m(rule.url_category),
    action: rule.action,
    'rule-type': rule.rule_type,
    'log-start': rule.log_start ? 'yes' : 'no',
    'log-end': rule.log_end ? 'yes' : 'no',
    disabled: rule.disabled ? 'yes' : 'no',
  };
  if (rule.description) entry.description = rule.description;
  if (rule.tags.length) entry.tag = m(rule.tags);
  if (rule.profile_group) entry['profile-setting'] = { group: m([rule.profile_group]) };
  if (rule.log_setting) entry['log-setting'] = rule.log_setting;
  if (rule.schedule && rule.schedule.toLowerCase() !== 'any') entry.schedule = rule.schedule;
  if (rule.negate_source) entry['negate-source'] = 'yes';
  if (rule.negate_destination) entry['negate-destination'] = 'yes';
  return { entry: [entry] };
};

/** REST API (v11.0) curl commands */
export const generateRestApiCommands = (
  rules: PanosRule[],
  opts: PanosTargetOptions,
  apiVersion = 'v11.0'
): string => {
  const host = opts.host || '{firewall}';
  const scope =
    opts.target === 'panorama'
      ? `location=device-group&device-group=${encodeURIComponent(opts.deviceGroup)}&rulebase=${opts.rulebase === 'pre-rulebase' ? 'pre' : 'post'}`
      : `location=vsys&vsys=${encodeURIComponent(opts.vsys)}`;

  let out = '# Palo Alto PAN-OS REST API - Security Policy Rules\n';
  out += `# Target: ${opts.target === 'panorama' ? `Panorama, device-group "${opts.deviceGroup}" (${opts.rulebase})` : `Firewall, vsys "${opts.vsys}"`}\n`;
  out += `# Generated: ${new Date().toISOString()}\n`;
  out += `# Replace ${opts.apiKeyPlaceholder} with a valid API key.\n\n`;

  rules.forEach((rule, i) => {
    const body = JSON.stringify(ruleToRestJson(rule));
    out += `# ---- Rule ${i + 1}: ${rule.rule_name} ----\n`;
    out += `curl -k -X POST "https://${host}/restapi/${apiVersion}/Policies/SecurityRules?${scope}&name=${encodeURIComponent(rule.rule_name)}" \\\n`;
    out += `  -H "X-PAN-KEY: ${opts.apiKeyPlaceholder}" \\\n`;
    out += `  -H "Content-Type: application/json" \\\n`;
    out += `  -d '${body.replace(/'/g, "'\\''")}'\n\n`;
  });

  out += '# ---- Commit ----\n';
  out += `curl -k -X POST "https://${host}/api/?type=commit&key=${opts.apiKeyPlaceholder}&cmd=<commit></commit>"\n`;
  return out;
};

/** Single combined XML payload for all rules (useful for "set" of the whole rulebase) */
export const generateBulkXml = (rules: PanosRule[]): string =>
  `<rules>\n${rules.map((r) => '  ' + ruleToXml(r)).join('\n')}\n</rules>`;
