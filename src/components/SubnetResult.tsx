
import React, { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { subnetsToCsv, downloadFile, prefixToSubnetMask } from '@/lib/exportUtils';
import { Check, Copy, ChevronsUpDown, FileDown, Share2 } from 'lucide-react';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatNumber } from '@/lib/subnetUtils';
import { useToast } from '@/components/ui/use-toast';

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
  const { toast } = useToast();

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

      <div className="space-y-4">
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
                    {calculationMethod === 'vlans' ? `VLAN ${index + 1}` : `Subnet ${index + 1}`}
                  </span>
                  <h4 className="font-medium">{subnet.subnet}</h4>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatNumber(subnet.hostsCount)} usable hosts
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(subnet.subnet);
                  }}
                  className="size-8"
                >
                  {copiedText === subnet.subnet ? (
                    <Check className="size-4 text-green-500" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
                
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8">
                    <ChevronsUpDown className="size-4" />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
            
            <CollapsibleContent>
              <div className="p-4 space-y-4 bg-background/50">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium w-1/3">Network Address</TableCell>
                      <TableCell className="font-mono">{subnet.networkAddress}</TableCell>
                      <TableCell className="w-10">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleCopy(subnet.networkAddress)}
                          className="size-7"
                        >
                          {copiedText === subnet.networkAddress ? (
                            <Check className="size-3 text-green-500" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                    
                    <TableRow>
                      <TableCell className="font-medium">Subnet Mask</TableCell>
                      <TableCell className="font-mono">{prefixToSubnetMask(parseInt(subnet.subnet.split('/')[1], 10))}</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleCopy(prefixToSubnetMask(parseInt(subnet.subnet.split('/')[1], 10)))}
                          className="size-7"
                        >
                          {copiedText === prefixToSubnetMask(parseInt(subnet.subnet.split('/')[1], 10)) ? (
                            <Check className="size-3 text-green-500" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                    
                    <TableRow>
                      <TableCell className="font-medium">Broadcast Address</TableCell>
                      <TableCell className="font-mono">{subnet.broadcastAddress}</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleCopy(subnet.broadcastAddress)}
                          className="size-7"
                        >
                          {copiedText === subnet.broadcastAddress ? (
                            <Check className="size-3 text-green-500" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                    
                    <TableRow>
                      <TableCell className="font-medium">First Usable Host</TableCell>
                      <TableCell className="font-mono">{subnet.firstUsableHost}</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleCopy(subnet.firstUsableHost)}
                          className="size-7"
                        >
                          {copiedText === subnet.firstUsableHost ? (
                            <Check className="size-3 text-green-500" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                    
                    <TableRow>
                      <TableCell className="font-medium">Last Usable Host</TableCell>
                      <TableCell className="font-mono">{subnet.lastUsableHost}</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleCopy(subnet.lastUsableHost)}
                          className="size-7"
                        >
                          {copiedText === subnet.lastUsableHost ? (
                            <Check className="size-3 text-green-500" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </Button>
                      </TableCell>
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
