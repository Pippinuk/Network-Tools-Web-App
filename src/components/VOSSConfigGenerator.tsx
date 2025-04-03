import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { generateVOSSConfig, downloadFile, vlansAndSubnetsToCsv } from '@/lib/exportUtils';
import { Download, Server, Settings, AlertTriangle, FileSpreadsheet } from 'lucide-react';

interface VOSSConfigGeneratorProps {
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

const VOSSConfigGenerator: React.FC<VOSSConfigGeneratorProps> = ({ subnets, originalSubnet }) => {
  const [useFirstIps, setUseFirstIps] = useState(true);
  const [vlanIds, setVlanIds] = useState<Record<number, number>>({});
  const [vlanNames, setVlanNames] = useState<Record<number, string>>({});
  const { toast } = useToast();

  const isReservedVlanId = (id: number): boolean => {
    return (id >= 4060 && id <= 4094) || id === 4048;
  };

  const handleVlanIdChange = (index: number, value: string) => {
    const newVlanIds = { ...vlanIds };
    const numValue = parseInt(value, 10);
    
    if (!isNaN(numValue) && numValue > 0 && numValue <= 4094) {
      if (isReservedVlanId(numValue)) {
        toast({
          title: "Reserved VLAN ID",
          description: "VLAN ID 4048 and IDs 4060-4094 are system reserved by Extreme Networks VOSS.",
          variant: "destructive"
        });
        return;
      }
      
      newVlanIds[index] = numValue;
    } else if (value === '') {
      delete newVlanIds[index];
    } else if (!isNaN(numValue)) {
      toast({
        title: "Invalid VLAN ID",
        description: "VLAN ID must be between 1 and 4094",
        variant: "destructive"
      });
      return;
    }
    
    setVlanIds(newVlanIds);
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

  const getVlanName = (index: number, defaultVlanId: number): string => {
    const actualVlanId = vlanIds[index] || defaultVlanId;
    return vlanNames[index] || `VLAN-${actualVlanId}`;
  };

  const generateConfig = () => {
    const invalidVlanIds = Object.values(vlanIds).filter(id => isReservedVlanId(id));
    if (invalidVlanIds.length > 0) {
      toast({
        title: "Reserved VLAN IDs",
        description: "Configuration contains reserved VLAN IDs. Please update them before generating.",
        variant: "destructive"
      });
      return;
    }
    
    const config = generateVOSSConfig(subnets, vlanIds, useFirstIps, vlanNames);
    downloadFile(config, 'extreme-voss-config.txt', 'text/plain');
    
    toast({
      title: "Configuration Generated",
      description: "Extreme Networks VOSS configuration downloaded successfully.",
    });
  };

  const exportToCsv = () => {
    try {
      const csvContent = vlansAndSubnetsToCsv(subnets, vlanIds, vlanNames);
      downloadFile(csvContent, 'voss-vlans-subnets.csv', 'text/csv');
      
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
          <Server className="size-5" />
          Extreme Networks VOSS Configuration
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
            onClick={generateConfig}
            className="gap-2"
          >
            <Download className="size-4" />
            Generate Config
          </Button>
        </div>
      </div>

      <div className="flex items-center space-x-2 mb-4">
        <Switch 
          id="ip-selection" 
          checked={useFirstIps} 
          onCheckedChange={setUseFirstIps}
        />
        <Label htmlFor="ip-selection">
          {useFirstIps 
            ? "Use first 3 IPs of each subnet for interfaces" 
            : "Use last 3 IPs of each subnet for interfaces"
          }
        </Label>
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="p-2 text-left font-medium">Subnet</th>
              <th className="p-2 text-left font-medium">Default VLAN ID</th>
              <th className="p-2 text-left font-medium">Custom VLAN ID</th>
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
                    type="number"
                    min={1}
                    max={4094}
                    placeholder={`VLAN ID (1-4094)`}
                    value={vlanIds[index] || ''}
                    onChange={(e) => handleVlanIdChange(index, e.target.value)}
                    className="w-32 h-8"
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="text"
                    placeholder={`VLAN-${vlanIds[index] || index + 1}`}
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
          <strong>Note:</strong> VLAN ID 4048 and IDs 4060-4094 are system reserved by Extreme Networks VOSS.
        </p>
        <p>The configuration will include VLAN creation, interface IP addresses, and VRRP setup for high availability.</p>
      </div>
    </div>
  );
};

export default VOSSConfigGenerator;
