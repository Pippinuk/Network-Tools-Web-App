
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { subnetsToCsv, downloadFile, prefixToSubnetMask, generateVlanIds } from '@/lib/exportUtils';
import { FileDown, Share2, ChevronsUpDown } from 'lucide-react';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatNumber } from '@/lib/subnetUtils';
import { useToast } from '@/components/ui/use-toast';
import SubnetResultTable from './SubnetResultTable';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableRow 
} from '@/components/ui/table';

interface SubnetResultProps {
  subnets: Array<{
    subnet: string;
    networkAddress: string;
    broadcastAddress: string;
    firstUsableHost: string;
    lastUsableHost: string;
    hostsCount: number;
  }>;
  originalSubnet: string;
  calculationMethod?: 'vlans' | 'mask';
  className?: string;
}

const SubnetResult: React.FC<SubnetResultProps> = ({ 
  subnets,
  originalSubnet,
  calculationMethod = 'vlans',
  className
}) => {
  const [expandedSubnet, setExpandedSubnet] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [vlanIds, setVlanIds] = useState<Record<number, number>>({});
  const [vlanNames, setVlanNames] = useState<Record<number, string>>({});
  const { toast } = useToast();

  // Initialize VLAN IDs based on session storage
  React.useEffect(() => {
    const storedStartingVlanId = sessionStorage.getItem('startingVlanId') || '1';
    const storedExcludedVlans = sessionStorage.getItem('excludedVlans') || '';
    const startVlanId = parseInt(storedStartingVlanId, 10);
    
    // Parse excluded VLANs
    const parsedExcluded = parseExcludedVlans(storedExcludedVlans);
    
    if (!isNaN(startVlanId) && startVlanId > 0 && startVlanId <= 4094) {
      const newVlanIds = generateVlanIds(startVlanId, subnets.length, parsedExcluded);
      setVlanIds(newVlanIds);
    }
    
    // Listen for changes
    const handleStorageChange = () => {
      const updatedStartingVlanId = sessionStorage.getItem('startingVlanId') || '1';
      const updatedExcludedVlans = sessionStorage.getItem('excludedVlans') || '';
      const updatedStartVlanId = parseInt(updatedStartingVlanId, 10);
      const updatedParsedExcluded = parseExcludedVlans(updatedExcludedVlans);
      
      if (!isNaN(updatedStartVlanId) && updatedStartVlanId > 0 && updatedStartVlanId <= 4094) {
        const updatedVlanIds = generateVlanIds(updatedStartVlanId, subnets.length, updatedParsedExcluded);
        setVlanIds(updatedVlanIds);
      }
    };
    
    window.addEventListener('sessionStorageChange', handleStorageChange);
    
    return () => {
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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const toggleExpand = (subnet: string) => {
    if (expandedSubnet === subnet) {
      setExpandedSubnet(null);
    } else {
      setExpandedSubnet(subnet);
    }
  };

  const handleExportCsv = () => {
    try {
      const csvData = subnetsToCsv(subnets, originalSubnet, calculationMethod);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `subnet-slices-${timestamp}.csv`;
      downloadFile(csvData, filename, 'text/csv');
      
      toast({
        title: "Export Successful",
        description: `Exported ${subnets.length} subnets to ${filename}`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export subnet data",
        variant: "destructive"
      });
    }
  };

  if (!subnets.length) return null;

  const targetMask = subnets[0].subnet.split('/')[1];

  return (
    <div className={cn('glass-panel p-6 space-y-6 w-full opacity-0 animate-slide-up', className)} style={{animationFillMode: 'forwards', animationDelay: '0.2s'}}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Subnet Results</h3>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExportCsv}
            className="gap-2 text-sm"
          >
            <FileDown className="size-4" />
            <span>Export CSV</span>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {calculationMethod === 'vlans' 
            ? `Original subnet ${originalSubnet} divided into ${subnets.length} equal parts`
            : `Original subnet ${originalSubnet} divided into /${targetMask} subnets (${subnets.length} total)`
          }
        </p>
        <Separator className="my-4" />
      </div>

      {/* Table View */}
      <SubnetResultTable 
        subnets={subnets}
        vlanIds={vlanIds}
        vlanNames={vlanNames}
      />

      <div className="space-y-4 mt-6">
        <h4 className="text-sm font-medium">Detailed Subnet Information</h4>
        {subnets.map((subnet, index) => (
          <Collapsible 
            key={subnet.subnet} 
            className="border border-border rounded-lg overflow-hidden transition-all duration-200 hover:border-primary/20"
            open={expandedSubnet === subnet.subnet}
            onOpenChange={() => toggleExpand(subnet.subnet)}
          >
            <div className="bg-muted/50 p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-full">
                    {calculationMethod === 'vlans' ? `VLAN ${vlanIds[index] || index + 1}` : `Subnet ${index + 1}`}
                  </span>
                  <h4 className="font-medium">{subnet.subnet}</h4>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatNumber(subnet.hostsCount)} usable hosts
                </p>
              </div>
              
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <ChevronsUpDown className="size-4" />
                </Button>
              </CollapsibleTrigger>
            </div>
            
            <CollapsibleContent>
              <div className="p-4 space-y-4 bg-background/50">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium w-1/3">Network Address</TableCell>
                      <TableCell className="font-mono">{subnet.networkAddress}</TableCell>
                    </TableRow>
                    
                    <TableRow>
                      <TableCell className="font-medium">Subnet Mask</TableCell>
                      <TableCell className="font-mono">{prefixToSubnetMask(parseInt(subnet.subnet.split('/')[1], 10))}</TableCell>
                    </TableRow>
                    
                    <TableRow>
                      <TableCell className="font-medium">Broadcast Address</TableCell>
                      <TableCell className="font-mono">{subnet.broadcastAddress}</TableCell>
                    </TableRow>
                    
                    <TableRow>
                      <TableCell className="font-medium">First Usable Host</TableCell>
                      <TableCell className="font-mono">{subnet.firstUsableHost}</TableCell>
                    </TableRow>
                    
                    <TableRow>
                      <TableCell className="font-medium">Last Usable Host</TableCell>
                      <TableCell className="font-mono">{subnet.lastUsableHost}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>

      <div className="pt-2 flex justify-end">
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 text-sm"
        >
          <Share2 className="size-3" />
          <span>Share Results</span>
        </Button>
      </div>
    </div>
  );
};

export default SubnetResult;
