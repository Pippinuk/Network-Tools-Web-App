/**
 * Extreme Networks VOSS VLAN / I-SID / VRRP generation utilities
 */

import { ipToNumber, numberToIp, getNetworkAddress, isValidSubnet } from './subnetUtils';

export interface VlanRow {
  vlanId: number;
  name: string;
  subnet: string;
  isid: number;
  vrid?: number;
  masterSwitch?: number;
  dhcpEnabled?: boolean;
  dhcpServers?: string[];
}

export type IsidMode = 'offset' | 'prefix';

export type VridMode = 'vlan' | 'fixed' | 'parity' | 'formula';

export interface VridOptions {
  mode: VridMode;
  fixed: number;
  oddVrid: number;
  evenVrid: number;
  formula: string;
}

export const defaultVridOptions: VridOptions = {
  mode: 'vlan',
  fixed: 1,
  oddVrid: 1,
  evenVrid: 2,
  formula: '{id} % 255 + 1',
};

export const isValidVrid = (vrid: number): boolean =>
  Number.isInteger(vrid) && vrid >= 1 && vrid <= 255;

/** Evaluate a whitelisted arithmetic formula using {id} (VLAN ID) and {n} (sequence number, 1-based). */
export const evaluateVridFormula = (formula: string, vlanId: number, index: number): number => {
  const expr = formula
    .replace(/\{\s*id\s*\}/gi, String(vlanId))
    .replace(/\{\s*n\s*\}/gi, String(index + 1));
  if (!/^[\d\s+\-*/%().]+$/.test(expr)) throw new Error('Formula may only use numbers, {id}, {n} and + - * / % ( )');
  // eslint-disable-next-line no-new-func
  const value = Function(`"use strict"; return (${expr});`)();
  if (typeof value !== 'number' || !isFinite(value)) throw new Error('Formula did not produce a number');
  return Math.floor(value);
};

export const computeVrid = (vlanId: number, index: number, opts: VridOptions): number => {
  switch (opts.mode) {
    case 'fixed':
      return opts.fixed;
    case 'parity':
      return vlanId % 2 === 0 ? opts.evenVrid : opts.oddVrid;
    case 'formula':
      try {
        return evaluateVridFormula(opts.formula, vlanId, index);
      } catch {
        return NaN;
      }
    case 'vlan':
    default:
      return ((vlanId - 1) % 255) + 1;
  }
};

export type MasterMode = 'first' | 'alternate' | 'parity';

/** Which switch (1-based) should be the VRRP master for a given VLAN. */
export const computeMasterSwitch = (
  vlanId: number,
  index: number,
  switchCount: number,
  mode: MasterMode
): number => {
  const count = Math.max(1, switchCount);
  switch (mode) {
    case 'alternate':
      return (index % count) + 1;
    case 'parity':
      return (vlanId % 2 === 0 ? 1 : Math.min(2, count)) as number;
    case 'first':
    default:
      return 1;
  }
};

export const isValidMasterSwitch = (value: number, switchCount: number): boolean =>
  Number.isInteger(value) && value >= 1 && value <= Math.max(1, switchCount);

export interface IsidOptions {
  mode: IsidMode;
  base: number;
  prefix: number;
}

export interface VrrpOptions {
  useFirstIps: boolean;
  switchCount: number;
  priority: number;
  backupMaster: boolean;
  memberPorts: string;
  mltId?: number;
  vrid?: VridOptions;
  masterMode?: MasterMode;
  dhcpEnabled?: boolean;
  dhcpServers?: string[];
}

export const isValidIpv4 = (ip: string): boolean =>
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(ip.trim());

export const isReservedVlanId = (id: number): boolean =>
  id === 4048 || (id >= 4060 && id <= 4094);

export const isValidVlanId = (id: number): boolean =>
  Number.isInteger(id) && id >= 2 && id <= 4094;

export const isValidIsid = (isid: number): boolean =>
  Number.isInteger(isid) && isid >= 1 && isid <= 16777215;

export const parseNumberList = (input: string): number[] => {
  if (!input || !input.trim()) return [];
  const out = new Set<number>();
  input.split(',').forEach((chunk) => {
    const part = chunk.trim();
    if (!part) return;
    if (part.includes('-')) {
      const [a, b] = part.split('-').map((n) => parseInt(n.trim(), 10));
      if (!isNaN(a) && !isNaN(b) && b >= a) for (let i = a; i <= b; i++) out.add(i);
      return;
    }
    const n = parseInt(part, 10);
    if (!isNaN(n)) out.add(n);
  });
  return Array.from(out).sort((a, b) => a - b);
};

export const buildVlanIdRange = (start: number, count: number, excluded: number[] = []): number[] => {
  const ids: number[] = [];
  let current = start;
  while (ids.length < count && current <= 4094) {
    if (!excluded.includes(current) && !isReservedVlanId(current)) ids.push(current);
    current++;
  }
  return ids;
};

export const computeIsid = (vlanId: number, opts: IsidOptions): number =>
  opts.mode === 'prefix' ? opts.prefix * 10000 + vlanId : opts.base + vlanId;

export const splitSupernet = (supernet: string, targetPrefix: number, max = 1024): string[] => {
  if (!isValidSubnet(supernet)) throw new Error('Invalid supernet in CIDR notation');
  const [ip, basePrefixStr] = supernet.split('/');
  const basePrefix = parseInt(basePrefixStr, 10);
  if (targetPrefix <= basePrefix) throw new Error('Subnet size must be smaller than the supernet');
  if (targetPrefix > 30) throw new Error('Subnet prefix cannot be larger than /30');

  const baseNum = ipToNumber(getNetworkAddress(ip, basePrefix));
  const size = Math.pow(2, 32 - targetPrefix);
  const total = Math.min(Math.pow(2, targetPrefix - basePrefix), max);

  const result: string[] = [];
  for (let i = 0; i < total; i++) result.push(`${numberToIp(baseNum + i * size)}/${targetPrefix}`);
  return result;
};

export interface SubnetAddressing {
  network: string;
  broadcast: string;
  prefix: number;
  switchIps: string[];
  virtualIp: string;
}

export const getSubnetAddressing = (
  cidr: string,
  useFirstIps: boolean,
  switchCount: number
): SubnetAddressing => {
  const [ip, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);
  const network = ipToNumber(getNetworkAddress(ip, prefix));
  const size = Math.pow(2, 32 - prefix);
  const broadcast = network + size - 1;

  const ips: number[] = [];
  if (useFirstIps) {
    for (let i = 0; i <= switchCount; i++) ips.push(network + 1 + i);
  } else {
    for (let i = 0; i <= switchCount; i++) ips.push(broadcast - 1 - i);
  }

  return {
    network: numberToIp(network),
    broadcast: numberToIp(broadcast),
    prefix,
    virtualIp: numberToIp(ips[0]),
    switchIps: ips.slice(1).map(numberToIp),
  };
};

export const prefixToMask = (prefix: number): string => {
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return [(mask >>> 24) & 255, (mask >>> 16) & 255, (mask >>> 8) & 255, mask & 255].join('.');
};

export const CSV_TEMPLATE = `vlan_id,vlan_name,subnet,isid,vrid,master_switch,dhcp_enabled,dhcp_server_1,dhcp_server_2,dhcp_server_3
100,Data,10.10.100.0/24,10100,1,1,yes,10.1.1.10,10.1.1.11,
101,Voice,10.10.101.0/24,10101,2,2,yes,10.1.1.10,,
102,Wireless,10.10.102.0/24,,,,no,,,
`;

const parseBoolCell = (value?: string): boolean | undefined => {
  if (value === undefined) return undefined;
  const v = value.trim().toLowerCase();
  if (!v) return undefined;
  if (['yes', 'y', 'true', '1', 'enable', 'enabled'].includes(v)) return true;
  if (['no', 'n', 'false', '0', 'disable', 'disabled'].includes(v)) return false;
  return undefined;
};

export interface CsvParseResult {
  rows: VlanRow[];
  errors: string[];
}

export const parseVlanCsv = (text: string, isidOptions: IsidOptions): CsvParseResult => {
  const errors: string[] = [];
  const rows: VlanRow[] = [];

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length === 0) return { rows, errors: ['CSV file is empty'] };

  let startIdx = 0;
  if (lines[0].toLowerCase().includes('vlan')) startIdx = 1;

  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const lineNo = i + 1;
    const vlanId = parseInt(cols[0], 10);
    const name = cols[1] || '';
    const subnet = cols[2] || '';
    const isidRaw = cols[3];
    const vridRaw = cols[4];
    const masterRaw = cols[5];
    const dhcpEnabled = parseBoolCell(cols[6]);
    const dhcpServers = [cols[7], cols[8], cols[9]].map((c) => (c || '').trim()).filter(Boolean);

    if (!isValidVlanId(vlanId)) {
      errors.push(`Line ${lineNo}: invalid VLAN ID "${cols[0]}"`);
      continue;
    }
    if (isReservedVlanId(vlanId)) {
      errors.push(`Line ${lineNo}: VLAN ${vlanId} is reserved by VOSS`);
      continue;
    }
    if (!isValidSubnet(subnet)) {
      errors.push(`Line ${lineNo}: invalid subnet "${subnet}"`);
      continue;
    }

    let isid = isidRaw ? parseInt(isidRaw, 10) : NaN;
    if (isNaN(isid)) isid = computeIsid(vlanId, isidOptions);
    if (!isValidIsid(isid)) {
      errors.push(`Line ${lineNo}: invalid I-SID "${isidRaw}"`);
      continue;
    }

    let vrid: number | undefined = vridRaw ? parseInt(vridRaw, 10) : undefined;
    if (vrid !== undefined && !isValidVrid(vrid)) {
      errors.push(`Line ${lineNo}: invalid VRRP instance ID "${vridRaw}" (1-255)`);
      continue;
    }

    let masterSwitch: number | undefined = masterRaw ? parseInt(masterRaw, 10) : undefined;
    if (masterSwitch !== undefined && (!Number.isInteger(masterSwitch) || masterSwitch < 1 || masterSwitch > 8)) {
      errors.push(`Line ${lineNo}: invalid VRRP master switch "${masterRaw}"`);
      continue;
    }

    const badServer = dhcpServers.find((s) => !isValidIpv4(s));
    if (badServer) {
      errors.push(`Line ${lineNo}: invalid DHCP server address "${badServer}"`);
      continue;
    }

    rows.push({
      vlanId,
      name: name || `VLAN-${vlanId}`,
      subnet,
      isid,
      vrid,
      masterSwitch,
      dhcpEnabled: dhcpEnabled ?? (dhcpServers.length > 0 ? true : undefined),
      dhcpServers: dhcpServers.length > 0 ? dhcpServers.slice(0, 3) : undefined,
    });
  }

  return { rows, errors };
};

export const validateRows = (rows: VlanRow[]): string[] => {
  const errors: string[] = [];
  const seenVlan = new Set<number>();
  const seenIsid = new Set<number>();

  rows.forEach((row) => {
    if (!isValidVlanId(row.vlanId)) errors.push(`VLAN ${row.vlanId} is out of range (2-4094)`);
    if (isReservedVlanId(row.vlanId)) errors.push(`VLAN ${row.vlanId} is reserved by VOSS`);
    if (!isValidSubnet(row.subnet)) errors.push(`VLAN ${row.vlanId}: invalid subnet "${row.subnet}"`);
    if (!isValidIsid(row.isid)) errors.push(`VLAN ${row.vlanId}: invalid I-SID "${row.isid}"`);
    if (row.vrid !== undefined && !isValidVrid(row.vrid)) {
      errors.push(`VLAN ${row.vlanId}: VRRP instance ID must be between 1 and 255`);
    }
    if (seenVlan.has(row.vlanId)) errors.push(`Duplicate VLAN ID ${row.vlanId}`);
    if (seenIsid.has(row.isid)) errors.push(`Duplicate I-SID ${row.isid}`);
    if (!/^[\w.-]{1,32}$/.test(row.name)) {
      errors.push(`VLAN ${row.vlanId}: name must be 1-32 characters (letters, numbers, . _ -)`);
    }
    seenVlan.add(row.vlanId);
    seenIsid.add(row.isid);
  });

  return Array.from(new Set(errors));
};

export const generateVossVrrpConfig = (rows: VlanRow[], vrrp: VrrpOptions): string => {
  const lines: string[] = [];
  const switchCount = Math.max(1, vrrp.switchCount);

  lines.push('! ------------------------------------------------------------');
  lines.push('! Extreme Networks VOSS - VLAN / I-SID / VRRP configuration');
  lines.push(`! Generated: ${new Date().toISOString()}`);
  lines.push(`! VLANs: ${rows.length}   Switches in cluster: ${switchCount}`);
  lines.push('! ------------------------------------------------------------');
  lines.push('');

  for (let s = 0; s < switchCount; s++) {
    lines.push('! ============================================================');
    lines.push(`! SWITCH ${s + 1} of ${switchCount}`);
    lines.push('! ============================================================');
    lines.push('enable');
    lines.push('configure terminal');
    lines.push('');
    lines.push('router vrrp enable');
    lines.push('');

    rows.forEach((row, rowIndex) => {
      const vrid = row.vrid ?? computeVrid(row.vlanId, rowIndex, vrrp.vrid ?? defaultVridOptions);
      const addr = getSubnetAddressing(row.subnet, vrrp.useFirstIps, switchCount);
      const interfaceIp = addr.switchIps[s];
      const master = row.masterSwitch ?? computeMasterSwitch(row.vlanId, rowIndex, switchCount, vrrp.masterMode ?? 'first');
      const masterIndex = Math.min(Math.max(master, 1), switchCount) - 1;
      const distance = (s - masterIndex + switchCount) % switchCount;
      const priority = Math.max(1, vrrp.priority - distance * 20);

      lines.push(`! --- VLAN ${row.vlanId} (${row.name}) - ${row.subnet} - I-SID ${row.isid} - VRID ${vrid} - master: switch ${masterIndex + 1} ---`);
      lines.push(`vlan create ${row.vlanId} name "${row.name}" type port-mstprstp 0`);
      lines.push(`vlan i-sid ${row.vlanId} ${row.isid}`);
      if (vrrp.memberPorts.trim()) {
        lines.push(`vlan members add ${row.vlanId} ${vrrp.memberPorts.trim()} portmember`);
      }
      if (vrrp.mltId) lines.push(`vlan mlt ${row.vlanId} ${vrrp.mltId}`);
      lines.push(`interface vlan ${row.vlanId}`);
      lines.push(`ip address ${interfaceIp} ${prefixToMask(addr.prefix)}`);
      lines.push('ip vrrp version 3');
      lines.push(`ip vrrp address ${vrid} ${addr.virtualIp}`);
      lines.push(`ip vrrp ${vrid} priority ${priority}`);
      if (vrrp.backupMaster) lines.push(`ip vrrp ${vrid} backup-master enable`);
      lines.push(`ip vrrp ${vrid} enable`);
      const rowDhcpEnabled = row.dhcpEnabled ?? vrrp.dhcpEnabled;
      const dhcpServers = (row.dhcpServers && row.dhcpServers.length ? row.dhcpServers : vrrp.dhcpServers || [])
        .map((s) => s.trim())
        .filter(isValidIpv4)
        .slice(0, 3);
      if (rowDhcpEnabled && dhcpServers.length > 0) {
        lines.push('ip dhcp-relay');
        lines.push('exit');
        lines.push(`! DHCP relay forward paths for VLAN ${row.vlanId}`);
        dhcpServers.forEach((server) => {
          lines.push(`ip dhcp-relay fwd-path ${interfaceIp} ${server}`);
          lines.push(`ip dhcp-relay fwd-path ${interfaceIp} ${server} enable`);
          lines.push(`ip dhcp-relay fwd-path ${interfaceIp} ${server} mode bootp_dhcp`);
        });
        lines.push('');
        return;
      }
      lines.push('exit');
      lines.push('');
    });

    lines.push('end');
    lines.push('save config');
    lines.push('');
  }

  lines.push('! End of configuration');
  return lines.join('\n');
};

export const rowsToCsv = (rows: VlanRow[], useFirstIps = true): string => {
  const header =
    'vlan_id,vlan_name,subnet,isid,vrid,master_switch,dhcp_enabled,dhcp_server_1,dhcp_server_2,dhcp_server_3,gateway_vip,subnet_mask';
  const body = rows.map((row) => {
    const addr = getSubnetAddressing(row.subnet, useFirstIps, 1);
    const servers = (row.dhcpServers || []).slice(0, 3);
    return [
      row.vlanId,
      row.name,
      row.subnet,
      row.isid,
      row.vrid ?? '',
      row.masterSwitch ?? '',
      row.dhcpEnabled === undefined ? '' : row.dhcpEnabled ? 'yes' : 'no',
      servers[0] || '',
      servers[1] || '',
      servers[2] || '',
      addr.virtualIp,
      prefixToMask(addr.prefix),
    ].join(',');
  });
  return [header, ...body].join('\n');
};
