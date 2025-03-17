
import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isValidSubnet, calculateSubnetCount } from '@/lib/subnetUtils';
import { cn } from '@/lib/utils';
import { Network, Users, SplitSquareVertical, Divide } from 'lucide-react';

interface SubnetFormProps {
  onCalculate: (subnet: string, divisions: number) => void;
  onCalculateByMask: (subnet: string, targetPrefix: number) => void;
  className?: string;
}

const SubnetForm: React.FC<SubnetFormProps> = ({ onCalculate, onCalculateByMask, className }) => {
  const [subnet, setSubnet] = useState('');
  const [divisionsInput, setDivisionsInput] = useState('4');
  const [divisions, setDivisions] = useState(4);
  const [targetPrefix, setTargetPrefix] = useState(24);
  const [maxPrefix, setMaxPrefix] = useState(30);
  const [minPrefix, setMinPrefix] = useState(0);
  const [isValid, setIsValid] = useState(false);
  const [calculationMode, setCalculationMode] = useState<'vlans' | 'mask'>('vlans');
  const [subnetCount, setSubnetCount] = useState<number | null>(null);
  const { toast } = useToast();
  
  // Validate subnet whenever input changes
  useEffect(() => {
    const valid = isValidSubnet(subnet);
    setIsValid(valid);
    
    // If valid, set the min and max prefix values
    if (valid) {
      const prefix = parseInt(subnet.split('/')[1], 10);
      setMinPrefix(prefix + 1);
      setMaxPrefix(30); // Maximum useful subnet mask is /30 (4 addresses, 2 usable)
      setTargetPrefix(Math.min(Math.max(prefix + 1, targetPrefix), 30));
    }
  }, [subnet]);

  // Calculate subnet count when target prefix changes
  useEffect(() => {
    if (isValid && calculationMode === 'mask') {
      try {
        const prefix = parseInt(subnet.split('/')[1], 10);
        const count = calculateSubnetCount(prefix, targetPrefix);
        setSubnetCount(count);
      } catch (error) {
        setSubnetCount(null);
      }
    } else {
      setSubnetCount(null);
    }
  }, [subnet, targetPrefix, isValid, calculationMode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid subnet in CIDR notation (e.g., 192.168.1.0/24)",
        variant: "destructive"
      });
      return;
    }
    
    if (calculationMode === 'vlans') {
      // Ensure we have a valid number of divisions
      const divs = parseInt(divisionsInput, 10);
      if (isNaN(divs) || divs < 2) {
        toast({
          title: "Invalid Input",
          description: "Please enter a valid number of VLANs (minimum 2)",
          variant: "destructive"
        });
        return;
      }
      
      onCalculate(subnet, divs);
      toast({
        title: "Subnets Calculated",
        description: `Divided ${subnet} into ${divs} subnets`,
      });
    } else {
      onCalculateByMask(subnet, targetPrefix);
      toast({
        title: "Subnets Calculated",
        description: `Divided ${subnet} into /${targetPrefix} subnets`,
      });
    }
  };

  const handleReset = () => {
    setSubnet('');
    setDivisionsInput('');
    setDivisions(4);
    setTargetPrefix(24);
    setSubnetCount(null);
  };

  const handleDivisionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDivisionsInput(value);
    
    // Also update the numeric value if it's valid
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      setDivisions(numValue);
    }
  };

  const prefix = isValid ? parseInt(subnet.split('/')[1], 10) : 0;

  return (
    <form 
      onSubmit={handleSubmit} 
      className={cn('glass-panel p-6 space-y-6 max-w-md w-full mx-auto animate-fade-in', className)}
    >
      <div className="space-y-2">
        <Label htmlFor="subnet" className="flex items-center gap-2 text-base">
          <Network className="size-4" />
          <span>IP Subnet (CIDR notation)</span>
        </Label>
        <Input
          id="subnet"
          placeholder="e.g. 192.168.1.0/24"
          value={subnet}
          onChange={(e) => setSubnet(e.target.value)}
          className="input-glass"
        />
        <p className="text-xs text-muted-foreground">
          Enter a subnet in CIDR notation (e.g., 192.168.1.0/24)
        </p>
      </div>

      <Tabs value={calculationMode} onValueChange={(value) => setCalculationMode(value as 'vlans' | 'mask')} className="w-full">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="vlans" className="flex items-center gap-2">
            <Users className="size-4" />
            <span>By VLANs</span>
          </TabsTrigger>
          <TabsTrigger value="mask" className="flex items-center gap-2">
            <Divide className="size-4" />
            <span>By Mask</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="vlans" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <Label htmlFor="divisions" className="flex items-center gap-2 text-base">
              <Users className="size-4" />
              <span>Number of VLANs</span>
            </Label>
          </div>
          
          <Input
            id="divisions"
            type="number"
            min={2}
            max={1024}
            value={divisionsInput}
            onChange={handleDivisionsChange}
            className="input-glass"
          />
          
          <p className="text-xs text-muted-foreground">
            How many VLANs do you want to divide this subnet into? (2-1024)
          </p>
        </TabsContent>
        
        <TabsContent value="mask" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <Label htmlFor="targetPrefix" className="flex items-center gap-2 text-base">
              <Divide className="size-4" />
              <span>Target Subnet Mask</span>
            </Label>
            <span className="text-sm font-medium bg-primary/10 text-primary px-2 py-1 rounded-md">
              /{targetPrefix}
            </span>
          </div>
          
          {isValid && (
            <Slider
              id="targetPrefix"
              min={minPrefix}
              max={maxPrefix}
              step={1}
              value={[targetPrefix]}
              onValueChange={(value) => setTargetPrefix(value[0])}
              className="py-4"
              disabled={!isValid}
            />
          )}
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Original: /{prefix}</span>
            <span>Target: /{targetPrefix}</span>
          </div>
          
          {subnetCount !== null && (
            <div className="bg-primary/5 p-3 rounded-md text-sm">
              <p>This will create <strong>{subnetCount}</strong> subnets with <strong>{Math.pow(2, 32 - targetPrefix) - 2}</strong> usable hosts each.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex gap-4 pt-2">
        <Button 
          type="submit" 
          className="flex-1 gap-2"
          disabled={!isValid || (calculationMode === 'vlans' && (!divisionsInput || parseInt(divisionsInput, 10) < 2))}
        >
          <SplitSquareVertical className="size-4" />
          <span>Slice Subnet</span>
        </Button>
        
        <Button 
          type="button" 
          variant="secondary" 
          onClick={handleReset}
          className="gap-2"
        >
          Reset
        </Button>
      </div>
    </form>
  );
};

export default SubnetForm;
