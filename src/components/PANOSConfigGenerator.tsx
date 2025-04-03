import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { downloadFile, vlansAndSubnetsToCsv } from '@/lib/exportUtils';
import { Download, Shield, Globe, AlertTriangle, FileSpreadsheet } from 'lucide-react';

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
  const [vlanNames, setVlanNames] = useState<Record<number, string>>({});
  const { toast } = useToast();

  const handleVlanNameChange = (index: number, value: string) => {
    const newVlanNames = { ...vlanNames };
    if (value.trim() !== '') {
      newVlanNames[index] = value.trim();
    } else {
      delete newVlanNames[index];
    }
    setVlanNames(newVlanNames);
  };

  const getVlanName = (index: number): string => {
    return vlanNames[index] || `VLAN-${index + 1}`;
  };

  const generatePANOSConfig = () => {
    try {
      let config = '# Palo Alto Networks PAN-OS REST API Configuration\n';
      config += `# Generated for subnet: ${originalSubnet}\n`;
      config += '# This is a template for API calls to configure interfaces and zones\n\n';
      
      subnets.forEach((subnet, index) => {
        const vlanId = index + 1;
        const vlanName = getVlanName(index);
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
      const vlanIds: Record<number, number> = {};
      subnets.forEach((_, index) => {
        vlanIds[index] = index + 1;
      });
      
      const csvContent = vlansAndSubnetsToCsv(subnets, vlanIds, vlanNames);
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
    <div className="space-y-4 glass-panel p-6 animate-fade-in">
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
            variant="outline" 
            size="sm" 
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

      <div className="border border-border rounded-md overflow-hidden mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="p-2 text-left font-medium">Subnet</th>
              <th className="p-2 text-left font-medium">VLAN ID</th>
              <th className="p-2 text-left font-medium">VLAN Name</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {subnets.map((subnet, index) => (
              <tr key={index} className="bg-card/50">
                <td className="p-2 font-mono">{subnet.subnet}</td>
                <td className="p-2">{index + 1}</td>
                <td className="p-2">
                  <Input
                    type="text"
                    placeholder={`VLAN-${index + 1}`}
                    value={vlanNames[index] || ''}
                    onChange={(e) => handleVlanNameChange(index, e.target.value)}
                    className="w-full h-8"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
