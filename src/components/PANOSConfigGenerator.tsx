
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { downloadFile, vlansAndSubnetsToCsv, generateVlanIds } from '@/lib/exportUtils';
import { Download, Shield, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import SubnetResultTable from './SubnetResultTable';

interface PANOSConfigGeneratorProps {
  subnets: Array<{
    subnet: string;
    networkAddress: string;
    broadcastAddress: string;
    firstUsableHost: string;
    lastUsableHost: string;
    hostsCount: number;
  }>;
  originalSubnet: string;
}

const PANOSConfigGenerator: React.FC<PANOSConfigGeneratorProps> = ({ subnets, originalSubnet }) => {
  const [useFirstIps, setUseFirstIps] = useState(true);
  const [zonePrefix, setZonePrefix] = useState('ZONE_');
  const [vlanIds, setVlanIds] = useState<Record<number, number>>({});
  const [vlanNames, setVlanNames] = useState<Record<number, string>>({});
  const [excludedVlansList, setExcludedVlansList] = useState<number[]>([]);
  const { toast } = useToast();

  const isReservedVlanId = (id: number): boolean => {
    return (id >= 4060 && id <= 4094) || id === 4048;
  };

  // Load VLAN IDs from sessionStorage
  useEffect(() => {
    // Get values from sessionStorage
    const storedStartingVlanId = sessionStorage.getItem('startingVlanId') || '1';
    const storedExcludedVlans = sessionStorage.getItem('excludedVlans') || '';
    
    // Parse excluded VLANs
    const parsedExcluded = parseExcludedVlans(storedExcludedVlans);
    setExcludedVlansList(parsedExcluded);
    
    // Generate VLAN IDs based on starting ID and exclusions
    const startVlanId = parseInt(storedStartingVlanId, 10);
    if (!isNaN(startVlanId) && startVlanId > 0 && startVlanId <= 4094) {
      const newVlanIds = generateVlanIds(startVlanId, subnets.length, parsedExcluded);
      setVlanIds(newVlanIds);
    }
  }, [subnets.length]);

  // Listen for changes in sessionStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const storedStartingVlanId = sessionStorage.getItem('startingVlanId') || '1';
      const storedExcludedVlans = sessionStorage.getItem('excludedVlans') || '';
      const parsedExcluded = parseExcludedVlans(storedExcludedVlans);
      setExcludedVlansList(parsedExcluded);
      
      const startVlanId = parseInt(storedStartingVlanId, 10);
      if (!isNaN(startVlanId) && startVlanId > 0 && startVlanId <= 4094) {
        const newVlanIds = generateVlanIds(startVlanId, subnets.length, parsedExcluded);
        setVlanIds(newVlanIds);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('sessionStorageChange', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sessionStorageChange', handleStorageChange);
    };
  }, [subnets.length]);

  const parseExcludedVlans = (input: string): number[] => {
    if (!input.trim()) return [];
    
    try {
      return input.split(',')
        .map(part => part.trim())
        .filter(part => part.length > 0)
        .map(part => {
          const num = parseInt(part, 10);
          if (isNaN(num)) throw new Error(`Invalid VLAN ID: ${part}`);
          return num;
        });
    } catch (error) {
      console.error('Error parsing excluded VLANs:', error);
      return [];
    }
  };

  const handleVlanNameChange = (index: number, value: string) => {
    const newVlanNames = { ...vlanNames };
    if (value.trim() !== '') {
      newVlanNames[index] = value.trim();
    } else {
      delete newVlanNames[index];
    }
    setVlanNames(newVlanNames);
  };

  const generatePANOSConfig = () => {
    try {
      // Get latest values from sessionStorage
      const storedStartingVlanId = sessionStorage.getItem('startingVlanId') || '1';
      const storedExcludedVlans = sessionStorage.getItem('excludedVlans') || '';
      const vlanId = parseInt(storedStartingVlanId, 10);
      const parsedExcludedVlansList = parseExcludedVlans(storedExcludedVlans);
      
      if (isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
        toast({
          title: "Invalid VLAN ID",
          description: "VLAN ID must be between 1 and 4094.",
          variant: "destructive"
        });
        return;
      }
      
      // Check if starting VLAN ID is in excluded list
      if (parsedExcludedVlansList.includes(vlanId)) {
        toast({
          title: "Starting VLAN ID Excluded",
          description: `The starting VLAN ID ${vlanId} is in your exclusion list.`,
          variant: "destructive"
        });
        return;
      }

      let config = '# Palo Alto Networks PAN-OS REST API Configuration\n';
      config += `# Generated for subnet: ${originalSubnet}\n`;
      config += '# This is a template for API calls to configure interfaces and zones\n\n';
      
      subnets.forEach((subnet, index) => {
        const vlanId = vlanIds[index] || (index + 1);
        const vlanName = vlanNames[index] || `VLAN-${vlanId}`;
        const zoneName = `${zonePrefix}${vlanId}`;
        const interfaceName = `ethernet1/${index + 1}`;
        const ipAddress = useFirstIps ? subnet.firstUsableHost : subnet.lastUsableHost;
        const subnetMask = subnet.subnet.split('/')[1];
        
        config += `# Create Zone: ${zoneName}\n`;
        config += 'curl -X POST https://{firewall}/api/ \\\n';
        config += '  -d "type=config" \\\n';
        config += '  -d "action=set" \\\n';
        config += '  -d "key={api_key}" \\\n';
        config += `  -d "xpath=/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/zone" \\\n`;
        config += `  -d "element=<entry name='${zoneName}'><network><layer3><member>${interfaceName}</member></layer3></network></entry>"\n\n`;
        
        config += `# Configure Interface: ${interfaceName} (${vlanName})\n`;
        config += 'curl -X POST https://{firewall}/api/ \\\n';
        config += '  -d "type=config" \\\n';
        config += '  -d "action=set" \\\n';
        config += '  -d "key={api_key}" \\\n';
        config += `  -d "xpath=/config/devices/entry[@name='localhost.localdomain']/network/interface/ethernet/entry[@name='ethernet1/${index + 1}']" \\\n`;
        config += `  -d "element=<layer3><ip><entry name='${ipAddress}/${subnetMask}'></entry></ip><interface-management><https>yes</https><ping>yes</ping></interface-management></layer3>"\n\n`;
        
        config += `# Configure VLAN tagging for interface: ${interfaceName} (${vlanName})\n`;
        config += 'curl -X POST https://{firewall}/api/ \\\n';
        config += '  -d "type=config" \\\n';
        config += '  -d "action=set" \\\n';
        config += '  -d "key={api_key}" \\\n';
        config += `  -d "xpath=/config/devices/entry[@name='localhost.localdomain']/network/interface/ethernet/entry[@name='ethernet1/${index + 1}']/layer3" \\\n`;
        config += `  -d "element=<units><entry name='ethernet1/${index + 1}.${vlanId}'><tag>${vlanId}</tag><comment>${vlanName}</comment><ip><entry name='${ipAddress}/${subnetMask}'/></ip></entry></units>"\n\n`;
      });
      
      config += '# Notes:\n';
      config += '# 1. Replace {firewall} with your firewall\'s IP address or hostname\n';
      config += '# 2. Replace {api_key} with your actual API key\n';
      config += '# 3. Review and modify these API calls as needed for your environment\n';
      config += '# 4. Consider using a proper API client library instead of raw curl commands for production use\n';
      
      downloadFile(config, 'palo-alto-panos-config.txt', 'text/plain');
      
      toast({
        title: "Configuration Generated",
        description: "Palo Alto PAN-OS configuration downloaded successfully.",
      });
    } catch (error) {
      console.error('Configuration generation error:', error);
      toast({
        title: "Configuration Error",
        description: "Failed to generate Palo Alto configuration.",
        variant: "destructive"
      });
    }
  };

  const exportToCsv = () => {
    try {
      // Get latest values from sessionStorage
      const storedStartingVlanId = sessionStorage.getItem('startingVlanId') || '1';
      const storedExcludedVlans = sessionStorage.getItem('excludedVlans') || '';
      const vlanId = parseInt(storedStartingVlanId, 10);
      const parsedExcludedVlansList = parseExcludedVlans(storedExcludedVlans);
      
      if (isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
        toast({
          title: "Invalid VLAN ID",
          description: "VLAN ID must be between 1 and 4094.",
          variant: "destructive"
        });
        return;
      }
      
      // Check if starting VLAN ID is in excluded list
      if (parsedExcludedVlansList.includes(vlanId)) {
        toast({
          title: "Starting VLAN ID Excluded",
          description: `The starting VLAN ID ${vlanId} is in your exclusion list.`,
          variant: "destructive"
        });
        return;
      }
      
      const csvContent = vlansAndSubnetsToCsv(subnets, vlanIds, vlanNames, parsedExcludedVlansList);
      downloadFile(csvContent, 'panos-vlans-subnets.csv', 'text/csv');
      
      toast({
        title: "CSV Export Complete",
        description: "VLAN and subnet data has been exported to CSV successfully.",
      });
    } catch (error) {
      console.error('CSV export error:', error);
      toast({
        title: "Export Error",
        description: "Failed to export data to CSV format.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Shield className="size-5" />
          Palo Alto PAN-OS Configuration
        </h3>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportToCsv}
            className="gap-2"
          >
            <FileSpreadsheet className="size-4" />
            Export CSV
          </Button>
          <Button 
            onClick={generatePANOSConfig}
            className="gap-2"
          >
            <Download className="size-4" />
            Generate Config
          </Button>
        </div>
      </div>

      <div className="flex items-center space-x-2 mb-4">
        <Switch 
          id="ip-selection-panos" 
          checked={useFirstIps} 
          onCheckedChange={setUseFirstIps}
        />
        <Label htmlFor="ip-selection-panos">
          {useFirstIps 
            ? "Use first IP of each subnet for interfaces" 
            : "Use last IP of each subnet for interfaces"
          }
        </Label>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="zonePrefix" className="text-sm">
          Zone Name Prefix
        </Label>
        <Input
          id="zonePrefix"
          value={zonePrefix}
          onChange={(e) => setZonePrefix(e.target.value)}
          placeholder="Enter prefix for zone names"
          className="w-full sm:w-48"
        />
        <p className="text-xs text-muted-foreground">
          Zones will be named using this prefix followed by the VLAN ID
        </p>
      </div>

      <SubnetResultTable 
        subnets={subnets}
        vlanIds={vlanIds}
        vlanNames={vlanNames}
        onVlanNameChange={handleVlanNameChange}
        className="mt-4"
      />

      <div className="text-xs text-muted-foreground pt-2">
        <p className="flex items-center gap-1 text-amber-500">
          <AlertTriangle className="size-3.5" />
          <strong>Note:</strong> This generates REST API calls for Palo Alto Networks firewalls.
        </p>
        <p>You'll need to replace {'{api_key}'} with your actual API key and {'{firewall}'} with your firewall's address.</p>
      </div>
    </div>
  );
};

export default PANOSConfigGenerator;
