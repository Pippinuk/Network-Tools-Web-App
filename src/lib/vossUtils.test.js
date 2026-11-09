import { describe, expect, test } from 'bun:test';
import { CSV_TEMPLATE, DEFAULT_VRF, parseVlanCsv, resolveVrf, rowsToCsv, validateRows, generateVossVrrpConfig } from './vossUtils';

const isid = { mode: 'offset', base: 10000, prefix: 1 };
const row = { vlanId: 100, name: 'Data', subnet: '10.10.100.0/24', isid: 10100 };
const options = { useFirstIps: true, switchCount: 2, priority: 200, backupMaster: true, memberPorts: '', dhcpEnabled: true, dhcpServers: ['10.1.1.10'] };

describe('VOSS routing tables', () => {
  test('GlobalRouter is the default for omitted and blank VRFs and the CSV template', () => {
    expect(DEFAULT_VRF).toBe('GlobalRouter');
    expect(resolveVrf()).toBe('GlobalRouter');
    expect(resolveVrf('  ')).toBe('GlobalRouter');
    expect(resolveVrf('globalrouter')).toBe('GlobalRouter');
    for (const csv of ['vlan_id,vlan_name,subnet,isid\n100,Data,10.10.100.0/24,10100', 'vlan_id,vlan_name,subnet,isid,vrf\n100,Data,10.10.100.0/24,10100,', CSV_TEMPLATE]) {
      const parsed = parseVlanCsv(csv, isid);
      expect(parsed.errors).toEqual([]);
      expect(parsed.rows.every(r => r.vrf === 'GlobalRouter')).toBe(true);
    }
    const config = generateVossVrrpConfig([row], options);
    expect(config).not.toContain('vrf GlobalRouter');
    expect(config).not.toContain('router vrrp enable');
    expect(config).toContain('ip vrrp 100 enable');
    expect(config).toContain('ip dhcp-relay fwd-path 10.10.100.2 10.1.1.10');
  });

  test('per-VLAN VRFs override the shared automatic/manual default', () => {
    const config = generateVossVrrpConfig([row, { ...row, vlanId: 101, vrf: 'Voice' }], { ...options, defaultVrf: 'Corp' });
    expect(config).toContain('interface vlan 100\nvrf Corp\nip address');
    expect(config).toContain('interface vlan 101\nvrf Voice\nip address');
    const exported = parseVlanCsv(rowsToCsv([row, { ...row, vlanId: 101, vrf: 'Voice' }], true, false, 'Corp'), isid);
    expect(exported.errors).toEqual([]);
    expect(exported.rows.map(r => r.vrf)).toEqual(['Corp', 'Voice']);
  });

  test('DHCP paths use local switch addresses inside the correct named VRF and exit that context', () => {
    const config = generateVossVrrpConfig([{ ...row, vrf: 'Corp' }, { ...row, vlanId: 101 }], options);
    for (const ip of ['10.10.100.2', '10.10.100.3']) {
      expect(config).toContain(`router vrf Corp\nip dhcp-relay fwd-path ${ip} 10.1.1.10`);
      expect(config).toContain(`ip dhcp-relay fwd-path ${ip} 10.1.1.10 mode bootp_dhcp\nexit`);
    }
    expect(config).not.toContain('fwd-path 10.10.100.1');
  });

  test('VRF CSV columns preserve master and DHCP fields irrespective of column order', () => {
    const parsed = parseVlanCsv('vlan_id,vrf,vlan_name,subnet,isid,master_switch,dhcp_enabled,dhcp_server_1\n100,Corp,Data,10.10.100.0/24,10100,2,yes,10.1.1.10', isid);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({ vrf: 'Corp', masterSwitch: 2, dhcpEnabled: true, dhcpServers: ['10.1.1.10'] });
  });

  test('legacy exported gateway columns are not mistaken for a VRF', () => {
    const parsed = parseVlanCsv('vlan_id,vlan_name,subnet,isid,vrid,master_switch,dhcp_enabled,dhcp_server_1,dhcp_server_2,dhcp_server_3,gateway_vip,subnet_mask\n100,Data,10.10.100.0/24,10100,,,,,,,10.10.100.1,255.255.255.0', isid);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0].vrf).toBe('GlobalRouter');
  });

  test('invalid VRF names cannot inject configuration commands', () => {
    for (const vrf of ['Corp\nend', 'a'.repeat(17), 'Corp;end']) {
      expect(validateRows([{ ...row, vrf }]).length).toBeGreaterThan(0);
      expect(() => generateVossVrrpConfig([{ ...row, vrf }], options)).toThrow();
    }
  });

  test('Layer 2-only output has no routing, VRRP or DHCP commands', () => {
    const config = generateVossVrrpConfig([{ ...row, subnet: '', vrf: 'Corp' }], { ...options, layer2Only: true });
    expect(config).toContain('vlan i-sid 100 10100');
    for (const command of ['interface vlan', 'vrf Corp', 'ip address', 'vrrp', 'dhcp-relay']) expect(config).not.toContain(command);
    expect(rowsToCsv([row], true, true)).toBe('vlan_id,vlan_name,isid\n100,Data,10100');
  });
});