import React, { useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from '@/components/Logo';
import SubnetForm from '@/components/SubnetForm';
import SubnetResult from '@/components/SubnetResult';
import Navigation from '@/components/Navigation';
import VOSSConfigGenerator from '@/components/VOSSConfigGenerator';
import PANOSConfigGenerator from '@/components/PANOSConfigGenerator';
import CSVExportGenerator from '@/components/CSVExportGenerator';
import { divideSubnet, divideSubnetByMask, divideRange } from '@/lib/subnetUtils';
import { Network, Github, Server, Shield, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SubnetInfo {
  subnet: string;
  networkAddress: string;
  broadcastAddress: string;
  firstUsableHost: string;
  lastUsableHost: string;
  hostsCount: number;
}

const Index = () => {
  const [subnets, setSubnets] = useState<SubnetInfo[]>([]);
  const [originalSubnet, setOriginalSubnet] = useState('');
  const [hasCalculated, setHasCalculated] = useState(false);
  const [calculationMethod, setCalculationMethod] = useState<'vlans' | 'mask'>('vlans');
  const [startingVlanId, setStartingVlanId] = useState('2'); // Changed default to 2
  const [configType, setConfigType] = useState<'voss' | 'panos' | 'csv'>('voss');
  const [excludedVlans, setExcludedVlans] = useState('');
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

  const handleCalculateByRange = (startIp: string, endIp: string, targetPrefix: number) => {
    try {
      const results = divideRange(startIp, endIp, targetPrefix);
      setSubnets(results);
      setOriginalSubnet(`${startIp} - ${endIp}`);
      setHasCalculated(true);
      setCalculationMethod('mask');
    } catch (error) {
      console.error('Calculation error:', error);
      toast({
        title: "Calculation Error",
        description: error instanceof Error ? error.message : "Unable to split this range",
        variant: "destructive"
      });
    }
  };

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

  const handleStartingVlanIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setStartingVlanId(newValue);
    sessionStorage.setItem('startingVlanId', newValue);
    
    window.dispatchEvent(new Event('sessionStorageChange'));
  };

  const handleExcludedVlansChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setExcludedVlans(newValue);
    sessionStorage.setItem('excludedVlans', newValue);
    
    window.dispatchEvent(new Event('sessionStorageChange'));
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
              IP Subnet Management & Configuration Export
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Divide IP Subnets & Generate Network Configurations
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Enter your IP subnet in CIDR notation, divide it into equal subnets for each VLAN, and automatically generate ready-to-deploy configurations for VOSS, PAN-OS, and CSV export formats.
            </p>
          </div>
        </section>

        <div className="max-w-5xl mx-auto space-y-8">
          <SubnetForm 
            onCalculate={handleCalculate}
            onCalculateByMask={handleCalculateByMask}
            onCalculateByRange={handleCalculateByRange}
          />
          
          {hasCalculated && (
            <>
              {/* Single Subnet Results Display */}
              <SubnetResult 
                subnets={subnets} 
                originalSubnet={originalSubnet}
                calculationMethod={calculationMethod}
              />
              
              <div className="glass-panel p-6 space-y-4 animate-fade-in" data-config-generator>
                <Tabs 
                  value={configType} 
                  onValueChange={(value) => setConfigType(value as 'voss' | 'panos' | 'csv')}
                  className="w-full"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">Network Configuration Generator</h3>
                    <TabsList className="grid grid-cols-3 w-[400px]">
                      <TabsTrigger value="voss" className="flex items-center gap-2">
                        <Server className="size-4" />
                        <span>VOSS VRRP</span>
                      </TabsTrigger>
                      <TabsTrigger value="panos" className="flex items-center gap-2">
                        <Shield className="size-4" />
                        <span>Palo Alto PANOS</span>
                      </TabsTrigger>
                      <TabsTrigger value="csv" className="flex items-center gap-2">
                        <FileSpreadsheet className="size-4" />
                        <span>CSV Export</span>
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
                        onChange={handleStartingVlanIdChange}
                        placeholder="Enter Starting VLAN ID (1-4094)"
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        VLAN IDs will be assigned incrementally from this number
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="excludedVlans" className="text-sm flex items-center gap-1">
                        Excluded VLAN IDs
                        <AlertTriangle className="size-3 text-yellow-500" />
                      </Label>
                      <Input
                        id="excludedVlans"
                        value={excludedVlans}
                        onChange={handleExcludedVlansChange}
                        placeholder="e.g. 100,200,300"
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        Comma-separated list of VLAN IDs to exclude
                      </p>
                    </div>
                  </div>
                  
                  <TabsContent value="voss" className="mt-0">
                    <VOSSConfigGenerator 
                      subnets={subnets} 
                      originalSubnet={originalSubnet}
                    />
                  </TabsContent>
                  
                  <TabsContent value="panos" className="mt-0">
                    <PANOSConfigGenerator 
                      subnets={subnets} 
                      originalSubnet={originalSubnet}
                    />
                  </TabsContent>

                  <TabsContent value="csv" className="mt-0">
                    <CSVExportGenerator
                      subnets={subnets}
                      originalSubnet={originalSubnet}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="w-full max-w-7xl mx-auto p-6 mt-auto">
        <Separator className="mb-6" />
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-muted-foreground text-sm">
          <Logo iconClassName="size-4" textClassName="text-base" />
          <p>© {new Date().getFullYear()} NetworkTools. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
