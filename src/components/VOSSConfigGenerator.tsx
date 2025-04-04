
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { generateVOSSConfig, downloadFile, vlansAndSubnetsToCsv, generateVlanIds } from '@/lib/exportUtils';
import { Download, Server, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

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

  // Get startingVlanId and excludedVlans from parent component via sessionStorage
  const [excludedVlansList, setExcludedVlansList] = useState<number[]>([]);

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

  const isReservedVlanId = (id: number): boolean => {
    return (id >= 4060 && id <= 4094) || id === 4048;
  };

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
    
    const config = generateVOSSConfig(subnets, vlanIds, useFirstIps, vlanNames, excludedVlansList);
    downloadFile(config, 'extreme-voss-config.txt', 'text/plain');
    
    toast({
      title: "Configuration Generated",
      description: "Extreme Networks VOSS configuration downloaded successfully.",
    });
  };

  const exportToCsv = () => {
    try {
      const csvContent = vlansAndSubnetsToCsv(subnets, vlanIds, vlanNames, excludedVlansList);
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

  return (
    <div className="space-y-4">
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
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="p-2 text-left font-medium">Subnet</TableHead>
              <TableHead className="p-2 text-left font-medium">VLAN ID</TableHead>
              <TableHead className="p-2 text-left font-medium">VLAN Name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subnets.map((subnet, index) => {
              const currentVlanId = vlanIds[index] || index + 1;
              return (
                <TableRow key={index} className="bg-card/50">
                  <TableCell className="p-2 font-mono">{subnet.subnet}</TableCell>
                  <TableCell className="p-2">{currentVlanId}</TableCell>
                  <TableCell className="p-2">
                    <Input
                      type="text"
                      placeholder={`VLAN-${currentVlanId}`}
                      value={vlanNames[index] || ''}
                      onChange={(e) => handleVlanNameChange(index, e.target.value)}
                      className="w-full h-8"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
