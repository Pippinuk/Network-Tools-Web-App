
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { subnetsToCsv, downloadFile, prefixToSubnetMask, generateVlanIds } from '@/lib/exportUtils';
import { FileDown, Share2, ChevronRight, ChevronDown, Network, Globe, Router, Users } from 'lucide-react';
import { formatNumber } from '@/lib/subnetUtils';
import { useToast } from '@/components/ui/use-toast';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead,
  TableHeader,
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
  const [vlanIds, setVlanIds] = useState<Record<number, number>>({});
  const { toast } = useToast();

  // Initialize VLAN IDs based on session storage with default starting at 2
  React.useEffect(() => {
    const storedStartingVlanId = sessionStorage.getItem('startingVlanId') || '2';
    const storedExcludedVlans = sessionStorage.getItem('excludedVlans') || '';
    const startVlanId = parseInt(storedStartingVlanId, 10);
    
    const parsedExcluded = parseExcludedVlans(storedExcludedVlans);
    
    if (!isNaN(startVlanId) && startVlanId > 0 && startVlanId <= 4094) {
      const newVlanIds = generateVlanIds(startVlanId, subnets.length, parsedExcluded);
      setVlanIds(newVlanIds);
    }
    
    const handleStorageChange = () => {
      const updatedStartingVlanId = sessionStorage.getItem('startingVlanId') || '2';
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

  const generateVlanName = (vlanId: number): string => {
    return `VLAN-${vlanId}`;
  };

  const toggleExpand = (subnet: string) => {
    setExpandedSubnet(expandedSubnet === subnet ? null : subnet);
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
    <Card className={cn('animate-fade-in', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Network className="size-5 text-primary" />
            Subnet Results
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExportCsv}
            className="gap-2"
          >
            <FileDown className="size-4" />
            Export CSV
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {calculationMethod === 'vlans' 
            ? `Original subnet ${originalSubnet} divided into ${subnets.length} equal parts`
            : `Original subnet ${originalSubnet} divided into /${targetMask} subnets (${subnets.length} total)`
          }
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Stylish Subnet Overview Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-20">VLAN</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Subnet</TableHead>
                <TableHead className="text-right">Hosts</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subnets.map((subnet, index) => {
                const currentVlanId = vlanIds[index] || (parseInt(sessionStorage.getItem('startingVlanId') || '2', 10) + index);
                const vlanName = generateVlanName(currentVlanId);
                const isExpanded = expandedSubnet === subnet.subnet;
                
                return (
                  <React.Fragment key={subnet.subnet}>
                    <TableRow 
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleExpand(subnet.subnet)}
                    >
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {currentVlanId}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{vlanName}</TableCell>
                      <TableCell className="font-mono text-sm">{subnet.subnet}</TableCell>
                      <TableCell className="text-right text-sm">
                        {formatNumber(subnet.hostsCount)}
                      </TableCell>
                      <TableCell>
                        {isExpanded ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                    
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={5} className="p-0">
                          <div className="p-4 bg-muted/20 border-t">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <Globe className="size-4 text-blue-500" />
                                  <span className="font-medium text-sm">Network Details</span>
                                </div>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Network Address:</span>
                                    <span className="font-mono">{subnet.networkAddress}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Subnet Mask:</span>
                                    <span className="font-mono">{prefixToSubnetMask(parseInt(subnet.subnet.split('/')[1], 10))}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Broadcast:</span>
                                    <span className="font-mono">{subnet.broadcastAddress}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <Users className="size-4 text-green-500" />
                                  <span className="font-medium text-sm">Host Range</span>
                                </div>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">First Host:</span>
                                    <span className="font-mono">{subnet.firstUsableHost}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Last Host:</span>
                                    <span className="font-mono">{subnet.lastUsableHost}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Hosts:</span>
                                    <span className="font-medium">{formatNumber(subnet.hostsCount)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="size-3" />
            Share Results
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SubnetResult;
