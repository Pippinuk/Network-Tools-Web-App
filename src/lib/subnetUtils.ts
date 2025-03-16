
/**
 * Utility functions for IP subnet calculations
 */

/**
 * Validates if the input is a valid IP address
 */
export const isValidIpAddress = (ip: string): boolean => {
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Pattern);
  
  if (!match) return false;
  
  // Check each octet is in range 0-255
  for (let i = 1; i <= 4; i++) {
    const octet = parseInt(match[i], 10);
    if (octet < 0 || octet > 255) return false;
  }
  
  return true;
};

/**
 * Validates if the input is a valid CIDR notation subnet
 */
export const isValidSubnet = (subnet: string): boolean => {
  const parts = subnet.split('/');
  
  if (parts.length !== 2) return false;
  
  const [ip, prefix] = parts;
  
  if (!isValidIpAddress(ip)) return false;
  
  const prefixNum = parseInt(prefix, 10);
  return !isNaN(prefixNum) && prefixNum >= 0 && prefixNum <= 32;
};

/**
 * Converts an IP address string to number representation
 */
export const ipToNumber = (ip: string): number => {
  const parts = ip.split('.');
  return ((parseInt(parts[0], 10) << 24) >>> 0) + 
         ((parseInt(parts[1], 10) << 16) >>> 0) + 
         ((parseInt(parts[2], 10) << 8) >>> 0) + 
         parseInt(parts[3], 10);
};

/**
 * Converts a number to IP address string
 */
export const numberToIp = (num: number): string => {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255
  ].join('.');
};

/**
 * Gets the subnet mask from prefix
 */
export const getPrefixMask = (prefix: number): number => {
  return (0xffffffff << (32 - prefix)) >>> 0;
};

/**
 * Gets the network address from IP and prefix
 */
export const getNetworkAddress = (ip: string, prefix: number): string => {
  const ipNum = ipToNumber(ip);
  const mask = getPrefixMask(prefix);
  return numberToIp(ipNum & mask);
};

/**
 * Gets the broadcast address from IP and prefix
 */
export const getBroadcastAddress = (ip: string, prefix: number): string => {
  const ipNum = ipToNumber(ip);
  const mask = getPrefixMask(prefix);
  return numberToIp((ipNum & mask) | (~mask >>> 0));
};

/**
 * Gets the total number of hosts in a subnet
 */
export const getHostsCount = (prefix: number): number => {
  return Math.pow(2, 32 - prefix) - 2; // -2 for network and broadcast
};

/**
 * Calculates how many bits are needed to accommodate a certain number of subnets
 */
export const bitsNeededForSubnets = (subnetCount: number): number => {
  return Math.ceil(Math.log2(subnetCount));
};

/**
 * Divides a subnet into smaller, equal-sized subnets
 */
export const divideSubnet = (subnet: string, divisions: number): Array<{
  subnet: string;
  networkAddress: string;
  broadcastAddress: string;
  firstUsableHost: string;
  lastUsableHost: string;
  hostsCount: number;
}> => {
  const [baseIp, basePrefix] = subnet.split('/');
  const basePrefixNum = parseInt(basePrefix, 10);
  
  // Calculate additional bits needed for divisions
  const additionalBits = bitsNeededForSubnets(divisions);
  const newPrefix = basePrefixNum + additionalBits;
  
  if (newPrefix > 30) {
    throw new Error("Cannot create the requested number of subnets. Resulting prefix would exceed 30.");
  }
  
  // Calculate the size of each subnet
  const baseIpNum = ipToNumber(getNetworkAddress(baseIp, basePrefixNum));
  const subnetSize = Math.pow(2, 32 - newPrefix);
  
  // Create the subnets
  const subnets = [];
  
  // We only generate the number of subnets requested, not all possible subnets
  const actualDivisions = Math.min(divisions, Math.pow(2, additionalBits));
  
  for (let i = 0; i < actualDivisions; i++) {
    const subnetStartIp = baseIpNum + (i * subnetSize);
    const subnetStartIpStr = numberToIp(subnetStartIp);
    
    const networkAddress = subnetStartIpStr;
    const broadcastAddress = numberToIp(subnetStartIp + subnetSize - 1);
    const firstUsableHost = numberToIp(subnetStartIp + 1);
    const lastUsableHost = numberToIp(subnetStartIp + subnetSize - 2);
    const hostsCount = getHostsCount(newPrefix);
    
    subnets.push({
      subnet: `${networkAddress}/${newPrefix}`,
      networkAddress,
      broadcastAddress,
      firstUsableHost,
      lastUsableHost,
      hostsCount
    });
  }
  
  return subnets;
};

/**
 * Formats a number with commas for thousands
 */
export const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};
