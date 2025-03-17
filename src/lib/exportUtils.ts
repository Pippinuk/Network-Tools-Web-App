
/**
 * Utility functions for exporting data
 */

/**
 * Converts subnet data to CSV format
 */
export const subnetsToCsv = (
  subnets: Array<{
    subnet: string;
    networkAddress: string;
    broadcastAddress: string;
    firstUsableHost: string;
    lastUsableHost: string;
    hostsCount: number;
  }>,
  originalSubnet: string,
  calculationMethod: 'vlans' | 'mask'
): string => {
  // Create CSV header
  const header = [
    'Index',
    'VLAN/Subnet',
    'Subnet CIDR',
    'Network Address',
    'Subnet Mask',
    'Broadcast Address',
    'First Usable Host',
    'Last Usable Host',
    'Usable Hosts Count'
  ].join(',');
  
  // Create CSV rows
  const rows = subnets.map((subnet, index) => {
    const cidrParts = subnet.subnet.split('/');
    const prefix = cidrParts[1];
    const subnetMask = prefixToSubnetMask(parseInt(prefix, 10));
    
    return [
      index + 1,
      calculationMethod === 'vlans' ? `VLAN ${index + 1}` : `Subnet ${index + 1}`,
      subnet.subnet,
      subnet.networkAddress,
      subnetMask,
      subnet.broadcastAddress,
      subnet.firstUsableHost,
      subnet.lastUsableHost,
      subnet.hostsCount
    ].join(',');
  });
  
  // Add metadata as comment at the top
  const metadata = [
    `# Original Subnet: ${originalSubnet}`,
    `# Calculation Method: ${calculationMethod === 'vlans' ? 'By VLANs' : 'By Subnet Mask'}`,
    `# Generated: ${new Date().toISOString()}`,
    ''
  ].join('\n');
  
  // Combine everything
  return metadata + header + '\n' + rows.join('\n');
};

/**
 * Converts CIDR prefix to subnet mask
 */
export const prefixToSubnetMask = (prefix: number): string => {
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return [
    (mask >>> 24) & 255,
    (mask >>> 16) & 255,
    (mask >>> 8) & 255,
    mask & 255
  ].join('.');
};

/**
 * Downloads data as a file
 */
export const downloadFile = (data: string, filename: string, mimeType: string): void => {
  const blob = new Blob([data], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

