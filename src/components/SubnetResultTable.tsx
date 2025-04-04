
import React, { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubnetResultTableProps {
  subnets: Array<{
    subnet: string;
    networkAddress: string;
    broadcastAddress: string;
    firstUsableHost: string;
    lastUsableHost: string;
    hostsCount: number;
  }>;
  vlanIds: Record<number, number>;
  vlanNames: Record<number, string>;
  onVlanNameChange?: (index: number, value: string) => void;
  className?: string;
}

const SubnetResultTable: React.FC<SubnetResultTableProps> = ({ 
  subnets,
  vlanIds,
  vlanNames,
  onVlanNameChange,
  className
}) => {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className={cn("border border-border rounded-md overflow-hidden", className)}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="p-2 text-left font-medium">Subnet</TableHead>
            <TableHead className="p-2 text-left font-medium">VLAN ID</TableHead>
            <TableHead className="p-2 text-left font-medium">VLAN Name</TableHead>
            <TableHead className="p-2 w-10"></TableHead>
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
                  {onVlanNameChange ? (
                    <Input
                      type="text"
                      placeholder={`VLAN-${currentVlanId}`}
                      value={vlanNames[index] || ''}
                      onChange={(e) => onVlanNameChange(index, e.target.value)}
                      className="w-full h-8"
                    />
                  ) : (
                    <span>{vlanNames[index] || `VLAN-${currentVlanId}`}</span>
                  )}
                </TableCell>
                <TableCell className="p-2 text-center">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleCopy(subnet.subnet)}
                    title="Copy subnet"
                  >
                    {copiedText === subnet.subnet ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default SubnetResultTable;
