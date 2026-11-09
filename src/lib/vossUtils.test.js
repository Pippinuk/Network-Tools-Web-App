import { describe, expect, test } from 'bun:test';
import { CSV_TEMPLATE, DEFAULT_VRF, parseVlanCsv, resolveVrf, rowsToCsv, validateRows, generateVossVrrpConfig } from './vossUtils';

const isid = { mode: 'offset', base: 10000, prefix: 1 };
const row = { vlanId: 100, name: 'Data', subnet: '10.10.100.0/24', isid: 10100 };
const options = { useFirstIps: true, switchCount: 2, priority: 200, backupMaster: true, memberPorts: '', dhcpEnabled: true, dhcpServers: ['10.1.1.10'] };

describe('VOSS routing tables', () => {
  test('spreadsheet headings accept VLAN IDs 2100, 2200 and 2300', () => {
    for (const header of ['VLAN ID,VLAN Name,Subnet,I-SID,VRF', 'vlan_id,vlan_name,subnet,isid,vrf', 'VLAN-ID,VLAN-Name,Subnet,I SID,VRF']) {
      for (const quoted of [false, true]) {
        let csv = `${header}\n2100,Data,10.21.0.0/24,12100,Corp\n2200,Voice,10.22.0.0/24,12200,GlobalRouter\n2300,Wireless,10.23.0.0/24,12300,Guest`;
        if (quoted) csv = '\ufeff' + csv.split('\n').map(line => line.split(',').map(cell => `"${cell}"`).join(',')).join('\r\n');
        const parsed = parseVlanCsv(csv, isid);
        expect(parsed.errors).toEqual([]);
        expect(parsed.rows.map(r => r.vlanId)).toEqual([2100, 2200, 2300]);
        expect(parsed.rows.map(r => r.vrf)).toEqual(['Corp', 'GlobalRouter', 'Guest']);
        expect(validateRows(parsed.rows)).toEqual([]);
      }
    }
  });

  test('headerless VLAN-named rows are not discarded as a header', () => {
    const parsed = parseVlanCsv('2100,VLAN-2100,10.21.0.0/24,12100', isid);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0].vlanId).toBe(2100);
  });

  test('spreadsheet parsing still blocks reserved VLAN IDs', () => {
    for (const id of [4048, 4060, 4094]) {
      const parsed = parseVlanCsv(`"VLAN ID","VLAN Name","Subnet","I-SID"\n"${id}","Data","10.21.0.0/24","12100"`, isid);
      expect(parsed.rows).toEqual([]);
      expect(parsed.errors[0]).toContain('reserved by VOSS');
    }
  });

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