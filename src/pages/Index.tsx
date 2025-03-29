
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from '@/components/Logo';
import SubnetForm from '@/components/SubnetForm';
import SubnetResult from '@/components/SubnetResult';
import Navigation from '@/components/Navigation';
import { divideSubnet, divideSubnetByMask } from '@/lib/subnetUtils';
import { Network, Github, Server } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

interface SubnetInfo {
  subnet: string;
  networkAddress: string;
  broadcastAddress: string;
  firstUsableHost: string;
  lastUsableHost: string;
  hostsCount: number;
}

const Index = () => {
  const navigate = useNavigate();
  const [subnets, setSubnets] = useState<SubnetInfo[]>([]);
  const [originalSubnet, setOriginalSubnet] = useState('');
  const [hasCalculated, setHasCalculated] = useState(false);
  const [calculationMethod, setCalculationMethod] = useState<'vlans' | 'mask'>('vlans');
  const [startingVlanId, setStartingVlanId] = useState('1');
  const { toast } = useToast();

  const handleCalculate = (subnet: string, divisions: number) => {
    try {
      const results = divideSubnet(subnet, divisions);
      setSubnets(results);
      setOriginalSubnet(subnet);
      setHasCalculated(true);
      setCalculationMethod('vlans');
    } catch (error) {
      console.error('Calculation error:', error);
    }
  };

  const handleCalculateByMask = (subnet: string, targetPrefix: number) => {
    try {
      const results = divideSubnetByMask(subnet, targetPrefix);
      setSubnets(results);
      setOriginalSubnet(subnet);
      setHasCalculated(true);
      setCalculationMethod('mask');
    } catch (error) {
      console.error('Calculation error:', error);
    }
  };

  const isReservedVlanId = (id: number): boolean => {
    return (id >= 4060 && id <= 4094) || id === 4048;
  };

  const handleVossConfigRedirect = () => {
    // Validate VLAN ID
    const vlanId = parseInt(startingVlanId, 10);
    
    if (isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
      // If invalid range, show error
      toast({
        title: "Invalid VLAN ID",
        description: "VLAN ID must be between 1 and 4094.",
        variant: "destructive"
      });
      return;
    }
    
    if (isReservedVlanId(vlanId)) {
      // If reserved VLAN ID, show error
      toast({
        title: "Reserved VLAN ID",
        description: "VLAN ID 4048 and IDs 4060-4094 are system reserved by Extreme Networks VOSS.",
        variant: "destructive"
      });
      return;
    }
    
    // Check if any sequential VLAN IDs will hit reserved range
    const lastVlanId = vlanId + subnets.length - 1;
    
    for (let id = vlanId; id <= lastVlanId; id++) {
      if (isReservedVlanId(id)) {
        toast({
          title: "Reserved VLAN ID in Range",
          description: `VLAN IDs ${vlanId}-${lastVlanId} include reserved IDs (4048 or 4060-4094).`,
          variant: "destructive"
        });
        return;
      }
    }
    
    // Store subnet data in sessionStorage to be retrieved in the VOSS config page
    sessionStorage.setItem('subnets', JSON.stringify(subnets));
    sessionStorage.setItem('originalSubnet', originalSubnet);
    sessionStorage.setItem('startingVlanId', startingVlanId);
    
    // Navigate to the VOSS config page
    navigate('/voss-config');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col theme-transition">
      <header className="w-full max-w-7xl mx-auto flex justify-between items-center p-6">
        <div className="flex items-center">
          <Navigation />
          <Logo />
        </div>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center gap-2"
        >
          <Github className="size-5" />
          <span className="hidden sm:inline">View on GitHub</span>
        </a>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto p-6">
        <section className="mb-16 text-center animate-slide-down">
          <div className="max-w-3xl mx-auto space-y-4 py-12">
            <div className="inline-flex items-center bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
              <Network className="size-4 mr-2" /> 
              IP Subnet Management
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Divide IP Subnets for Your VLANs
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Enter your IP subnet in CIDR notation and divide it into equal subnets for each VLAN, with detailed network information.
            </p>
          </div>
        </section>

        <div className="max-w-5xl mx-auto space-y-8">
          <SubnetForm 
            onCalculate={handleCalculate}
            onCalculateByMask={handleCalculateByMask}
          />
          
          {hasCalculated && (
            <>
              {/* Moved VOSS VRRP Configuration section above the subnet results */}
              <div className="glass-panel p-6 space-y-4 animate-fade-in">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Server className="size-5" />
                  Create VOSS VRRP Configuration
                </h3>
                
                <div className="space-y-2">
                  <Label htmlFor="startingVlanId" className="text-sm">
                    Starting VLAN ID
                  </Label>
                  <Input
                    id="startingVlanId"
                    type="number"
                    min={1}
                    max={4094}
                    value={startingVlanId}
                    onChange={(e) => setStartingVlanId(e.target.value)}
                    placeholder="Enter Starting VLAN ID (1-4094)"
                    className="w-full sm:w-48"
                  />
                  <p className="text-xs text-muted-foreground">
                    VLAN IDs will be assigned incrementally starting from this number
                  </p>
                </div>
                
                <Button 
                  onClick={handleVossConfigRedirect}
                  variant="outline"
                  className="gap-2"
                >
                  <Server className="size-4" />
                  Create VOSS VRRP Configuration
                </Button>
              </div>
              
              <SubnetResult 
                subnets={subnets} 
                originalSubnet={originalSubnet}
                calculationMethod={calculationMethod}
              />
            </>
          )}
        </div>
      </main>

      <footer className="w-full max-w-7xl mx-auto p-6 mt-auto">
        <Separator className="mb-6" />
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-muted-foreground text-sm">
          <Logo iconClassName="size-4" textClassName="text-base" />
          <p>© {new Date().getFullYear()} SubnetSlicer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
