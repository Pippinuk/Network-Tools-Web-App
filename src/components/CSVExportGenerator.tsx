
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { generateComprehensiveCsv, downloadFile, generateVlanIds } from '@/lib/exportUtils';
import { Download, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from "@/components/ui/input";

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
  const { toast } = useToast();

  // Get startingVlanId and excludedVlans from sessionStorage
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
      
      if (isReservedVlanId(vlanId)) {
        toast({
          title: "Reserved VLAN ID",
          description: "VLAN ID 4048 and IDs 4060-4094 are system reserved by Extreme Networks VOSS.",
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
      
      const csvContent = generateComprehensiveCsv(subnets, vlanIds, vlanNames, parsedExcludedVlansList);
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
    
    // Custom event for local changes
    window.addEventListener('sessionStorageChange', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sessionStorageChange', handleStorageChange);
    };
  }, [subnets.length]);

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
            {subnets.map((subnet, index) => {
              const currentVlanId = vlanIds[index] || index + 1;
              return (
                <TableRow key={index}>
                  <TableCell className="font-mono">{subnet.subnet}</TableCell>
                  <TableCell className="font-mono">{subnet.networkAddress}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      max={4094}
                      placeholder={`${currentVlanId}`}
                      value={vlanIds[index] || ''}
                      onChange={(e) => handleVlanIdChange(index, e.target.value)}
                      className="w-24 h-8"
                    />
                  </TableCell>
                  <TableCell>
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
        <p>The CSV will include: VLAN ID, VLAN Name, Subnet CIDR, Network Address, Subnet Mask, Broadcast Address, First Usable Host, Last Usable Host, and Usable Hosts Count.</p>
      </div>
    </div>
  );
};

export default CSVExportGenerator;
