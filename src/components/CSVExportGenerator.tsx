
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { generateComprehensiveCsv, downloadFile, generateVlanIds } from '@/lib/exportUtils';
import { Download, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CSVExportGeneratorProps {
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

const CSVExportGenerator: React.FC<CSVExportGeneratorProps> = ({ subnets, originalSubnet }) => {
  const [vlanIds, setVlanIds] = useState<Record<number, number>>({});
  const [vlanNames, setVlanNames] = useState<Record<number, string>>({});
  const [startingVlanId, setStartingVlanId] = useState('1');
  const [excludedVlans, setExcludedVlans] = useState('');
  const [excludedVlansList, setExcludedVlansList] = useState<number[]>([]);
  const { toast } = useToast();

  const isReservedVlanId = (id: number): boolean => {
    return (id >= 4060 && id <= 4094) || id === 4048;
  };

  // Parse excluded VLANs when input changes
  useEffect(() => {
    setExcludedVlansList(parseExcludedVlans(excludedVlans));
  }, [excludedVlans]);

  // Update VLAN IDs when starting VLAN ID or exclusions change
  useEffect(() => {
    const startVlanId = parseInt(startingVlanId, 10);
    if (!isNaN(startVlanId) && startVlanId > 0 && startVlanId <= 4094) {
      const newVlanIds = generateVlanIds(startVlanId, subnets.length, excludedVlansList);
      setVlanIds(newVlanIds);
    }
  }, [startingVlanId, excludedVlansList, subnets.length]);

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

  const exportToCsv = () => {
    try {
      // Validate VLAN ID
      const vlanId = parseInt(startingVlanId, 10);
      
      if (isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
        toast({
          title: "Invalid VLAN ID",
          description: "VLAN ID must be between 1 and 4094.",
          variant: "destructive"
        });
        return;
      }
      
      if (isReservedVlanId(vlanId)) {
        toast({
          title: "Reserved VLAN ID",
          description: "VLAN ID 4048 and IDs 4060-4094 are system reserved by Extreme Networks VOSS.",
          variant: "destructive"
        });
        return;
      }
      
      // Check if starting VLAN ID is in excluded list
      if (excludedVlansList.includes(vlanId)) {
        toast({
          title: "Starting VLAN ID Excluded",
          description: `The starting VLAN ID ${vlanId} is in your exclusion list.`,
          variant: "destructive"
        });
        return;
      }
      
      const csvContent = generateComprehensiveCsv(subnets, vlanIds, vlanNames, excludedVlansList);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadFile(csvContent, `vlans-subnets-export-${timestamp}.csv`, 'text/csv');
      
      toast({
        title: "CSV Export Complete",
        description: `Successfully exported ${subnets.length} subnets with VLAN information.`,
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <FileSpreadsheet className="size-5" />
          CSV Export Configuration
        </h3>
        <Button 
          onClick={exportToCsv}
          className="gap-2"
        >
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Customize VLAN IDs and names before exporting subnet information to CSV format. The export will include all subnet details including network addresses, subnet masks, broadcast addresses, and usable host ranges.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="space-y-2">
          <Label htmlFor="csvStartingVlanId" className="text-sm">
            Starting VLAN ID
          </Label>
          <Input
            id="csvStartingVlanId"
            type="number"
            min={1}
            max={4094}
            value={startingVlanId}
            onChange={(e) => setStartingVlanId(e.target.value)}
            placeholder="Enter Starting VLAN ID (1-4094)"
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            VLAN IDs will be assigned incrementally from this number
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="csvExcludedVlans" className="text-sm flex items-center gap-1">
            Excluded VLAN IDs
            <AlertTriangle className="size-3 text-yellow-500" />
          </Label>
          <Input
            id="csvExcludedVlans"
            value={excludedVlans}
            onChange={(e) => setExcludedVlans(e.target.value)}
            placeholder="e.g. 100,200,300"
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated list of VLAN IDs to exclude
          </p>
        </div>
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[180px]">Subnet CIDR</TableHead>
              <TableHead>Network Address</TableHead>
              <TableHead>VLAN ID</TableHead>
              <TableHead>VLAN Name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subnets.map((subnet, index) => (
              <TableRow key={index}>
                <TableCell className="font-mono">{subnet.subnet}</TableCell>
                <TableCell className="font-mono">{subnet.networkAddress}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    max={4094}
                    placeholder={`${vlanIds[index] || index + 1}`}
                    value={vlanIds[index] || ''}
                    onChange={(e) => handleVlanIdChange(index, e.target.value)}
                    className="w-24 h-8"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="text"
                    placeholder={`VLAN-${vlanIds[index] || index + 1}`}
                    value={vlanNames[index] || ''}
                    onChange={(e) => handleVlanNameChange(index, e.target.value)}
                    className="w-full h-8"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground pt-2">
        <p className="flex items-center gap-1 text-amber-500">
          <AlertTriangle className="size-3.5" />
          <strong>Note:</strong> VLAN ID 4048 and IDs 4060-4094 are system reserved by Extreme Networks VOSS.
        </p>
        <p>The CSV will include: VLAN ID, VLAN Name, Subnet CIDR, Network Address, Subnet Mask, Broadcast Address, First Usable Host, Last Usable Host, and Usable Hosts Count.</p>
      </div>
    </div>
  );
};

export default CSVExportGenerator;
