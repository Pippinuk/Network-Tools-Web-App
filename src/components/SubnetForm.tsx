
import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { isValidSubnet } from '@/lib/subnetUtils';
import { cn } from '@/lib/utils';
import { Network, Users, SplitSquareVertical } from 'lucide-react';

interface SubnetFormProps {
  onCalculate: (subnet: string, divisions: number) => void;
  className?: string;
}

const SubnetForm: React.FC<SubnetFormProps> = ({ onCalculate, className }) => {
  const [subnet, setSubnet] = useState('');
  const [divisions, setDivisions] = useState(4);
  const [isValid, setIsValid] = useState(false);
  const { toast } = useToast();
  
  // Validate subnet whenever input changes
  useEffect(() => {
    setIsValid(isValidSubnet(subnet));
  }, [subnet]);

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
    
    onCalculate(subnet, divisions);
    
    toast({
      title: "Subnets Calculated",
      description: `Divided ${subnet} into ${divisions} subnets`,
    });
  };

  const handleReset = () => {
    setSubnet('');
    setDivisions(4);
  };

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

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label htmlFor="divisions" className="flex items-center gap-2 text-base">
            <Users className="size-4" />
            <span>Number of Clans</span>
          </Label>
          <span className="text-sm font-medium bg-primary/10 text-primary px-2 py-1 rounded-md">
            {divisions}
          </span>
        </div>
        
        <Slider
          id="divisions"
          min={2}
          max={16}
          step={1}
          value={[divisions]}
          onValueChange={(value) => setDivisions(value[0])}
          className="py-4"
        />
        
        <p className="text-xs text-muted-foreground">
          How many clans do you want to divide this subnet into?
        </p>
      </div>

      <div className="flex gap-4 pt-2">
        <Button 
          type="submit" 
          className="flex-1 gap-2"
          disabled={!isValid}
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
