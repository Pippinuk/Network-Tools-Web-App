import React, { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { divideSubnet } from '@/lib/subnetUtils';
import { generateVOSSConfig, downloadFile } from '@/lib/exportUtils';
import Logo from '@/components/Logo';
import Navigation from '@/components/Navigation';
import { Github, Server, Download, Network, Layers, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SubnetInfo {
  subnet: string;
  networkAddress: string;
  broadcastAddress: string;
  firstUsableHost: string;
  lastUsableHost: string;
  hostsCount: number;
}

const VOSSConfig = () => {
  const [activeTab, setActiveTab] = useState<'from-subnet-slicer' | 'standalone'>('standalone');
  const [subnet, setSubnet] = useState('');
  const [vlansCount, setVlansCount] = useState('');
  const [startingVlanId, setStartingVlanId] = useState('');
  const [useFirstIps, setUseFirstIps] = useState(true);
  const [subnets, setSubnets] = useState<SubnetInfo[]>([]);
  const [vlanIds, setVlanIds] = useState<Record<number, number>>({});
  const [hasCalculated, setHasCalculated] = useState(false);
  const { toast } = useToast();

  const isReservedVlanId = (id: number): boolean => {
    return (id >= 4060 && id <= 4094) || id === 4048;
  };

  // Check for data from SubnetSlicer on component mount
  useEffect(() => {
    const storedSubnets = sessionStorage.getItem('subnets');
    const storedOriginalSubnet = sessionStorage.getItem('originalSubnet');
    const storedStartingVlanId = sessionStorage.getItem('startingVlanId');
    
    if (storedSubnets && storedOriginalSubnet) {
      try {
        const parsedSubnets = JSON.parse(storedSubnets) as SubnetInfo[];
        
        // If we have data from subnet slicer, set it and switch to that tab
        if (parsedSubnets.length > 0) {
          setSubnets(parsedSubnets);
          setSubnet(storedOriginalSubnet);
          
          // Get starting VLAN ID from session storage or default to 1
          const startVlanId = storedStartingVlanId ? 
            parseInt(storedStartingVlanId, 10) : 1;
          
          // Generate default VLAN IDs
          const vlanIdsMap: Record<number, number> = {};
          parsedSubnets.forEach((_, index) => {
            vlanIdsMap[index] = startVlanId + index;
          });
          setVlanIds(vlanIdsMap);
          
          // Also update the starting VLAN ID input field for reference
          setStartingVlanId(storedStartingVlanId || '1');
          
          setHasCalculated(true);
          setActiveTab('from-subnet-slicer');
          
          // Clean up sessionStorage
          sessionStorage.removeItem('subnets');
          sessionStorage.removeItem('originalSubnet');
          sessionStorage.removeItem('startingVlanId');
          
          toast({
            title: "Subnets Imported",
            description: `Imported ${parsedSubnets.length} subnets from Subnet Slicer`,
          });
        }
      } catch (error) {
        console.error('Error parsing stored subnets:', error);
      }
    }
  }, [toast]);

  const handleCalculate = () => {
    try {
      // Validate inputs
      if (!subnet || !vlansCount || !startingVlanId) {
        toast({
          title: "Missing Input",
          description: "Please fill in all required fields",
          variant: "destructive"
        });
        return;
      }

      const numVlans = parseInt(vlansCount, 10);
      const startVlanId = parseInt(startingVlanId, 10);

      if (isNaN(numVlans) || numVlans < 1 || numVlans > 4094) {
        toast({
          title: "Invalid Input",
          description: "Number of VLANs must be between 1 and 4094",
          variant: "destructive"
        });
        return;
      }

      if (isNaN(startVlanId) || startVlanId < 1 || startVlanId > 4094) {
        toast({
          title: "Invalid Input",
          description: "Starting VLAN ID must be between 1 and 4094",
          variant: "destructive"
        });
        return;
      }

      // Check if starting VLAN ID is reserved
      if (isReservedVlanId(startVlanId)) {
        toast({
          title: "Reserved VLAN ID",
          description: "VLAN ID 4048 and IDs 4060-4094 are system reserved by Extreme Networks VOSS.",
          variant: "destructive"
        });
        return;
      }

      // Check if VLAN range includes reserved IDs
      const lastVlanId = startVlanId + numVlans - 1;
      for (let id = startVlanId; id <= lastVlanId; id++) {
        if (isReservedVlanId(id)) {
          toast({
            title: "Reserved VLAN ID in Range",
            description: `VLAN IDs ${startVlanId}-${lastVlanId} include reserved IDs (4048 or 4060-4094).`,
            variant: "destructive"
          });
          return;
        }
      }

      if (startVlanId + numVlans - 1 > 4094) {
        toast({
          title: "Invalid Input",
          description: "VLAN range exceeds maximum VLAN ID (4094)",
          variant: "destructive"
        });
        return;
      }

      // Generate subnets
      const results = divideSubnet(subnet, numVlans);
      setSubnets(results);

      // Generate VLAN IDs mapping
      const vlanIdsMap: Record<number, number> = {};
      for (let i = 0; i < numVlans; i++) {
        vlanIdsMap[i] = startVlanId + i;
      }
      setVlanIds(vlanIdsMap);
      
      setHasCalculated(true);
      
      toast({
        title: "Calculation Complete",
        description: `Generated configuration for ${numVlans} VLANs`,
      });
    } catch (error) {
      console.error('Calculation error:', error);
      toast({
        title: "Calculation Error",
        description: error instanceof Error ? error.message : "Failed to calculate subnets",
        variant: "destructive"
      });
    }
  };

  const handleVlanIdChange = (index: number, value: string) => {
    const newVlanIds = { ...vlanIds };
    const numValue = parseInt(value, 10);
    
    // Check if it's a reserved VLAN ID
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
    } else if (!isNaN(numValue)) {
      toast({
        title: "Invalid VLAN ID",
        description: "VLAN ID must be between 1 and 4094",
        variant: "destructive"
      });
      return;
    }
    
    setVlanIds(newVlanIds);
  };

  const generateConfig = () => {
    if (!hasCalculated || subnets.length === 0) return;
    
    // Validate all VLAN IDs before generating config
    const invalidVlanIds = Object.values(vlanIds).filter(id => isReservedVlanId(id));
    if (invalidVlanIds.length > 0) {
      toast({
        title: "Reserved VLAN IDs",
        description: "Configuration contains reserved VLAN IDs. Please update them before generating.",
        variant: "destructive"
      });
      return;
    }
    
    const config = generateVOSSConfig(subnets, vlanIds, useFirstIps);
    downloadFile(config, 'extreme-voss-config.txt', 'text/plain');
    
    toast({
      title: "Configuration Generated",
      description: "Extreme Networks VOSS configuration downloaded successfully.",
    });
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
              <Server className="size-4 mr-2" /> 
              VOSS Configuration
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Extreme Networks VOSS VRRP Generator
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Generate VOSS configuration with VLAN and VRRP setup for high availability networking.
            </p>
          </div>
        </section>

        <div className="max-w-5xl mx-auto space-y-8">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'from-subnet-slicer' | 'standalone')} className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="standalone" className="flex items-center gap-2">
                <Layers className="size-4" />
                <span>Standalone VOSS Generator</span>
              </TabsTrigger>
              <TabsTrigger value="from-subnet-slicer" className="flex items-center gap-2">
                <Network className="size-4" />
                <span>From Subnet Slicer</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="standalone" className="space-y-6">
              <div className="glass-panel p-6 space-y-6 animate-fade-in">
                <div className="space-y-4">
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="vlansCount" className="flex items-center gap-2 text-base">
                        <span>Number of VLANs</span>
                      </Label>
                      <Input
                        id="vlansCount"
                        type="number"
                        placeholder="e.g. 4"
                        min={1}
                        max={4094}
                        value={vlansCount}
                        onChange={(e) => setVlansCount(e.target.value)}
                        className="input-glass"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="startingVlanId" className="flex items-center gap-2 text-base">
                        <span>Starting VLAN ID</span>
                      </Label>
                      <Input
                        id="startingVlanId"
                        type="number"
                        placeholder="e.g. 100"
                        min={1}
                        max={4094}
                        value={startingVlanId}
                        onChange={(e) => setStartingVlanId(e.target.value)}
                        className="input-glass"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <Switch 
                      id="ip-selection" 
                      checked={useFirstIps} 
                      onCheckedChange={setUseFirstIps}
                    />
                    <Label htmlFor="ip-selection">
                      {useFirstIps 
                        ? "Use first 3 IPs of each subnet for interfaces" 
                        : "Use last 3 IPs of each subnet for interfaces"
                      }
                    </Label>
                  </div>

                  <Button 
                    onClick={handleCalculate}
                    className="w-full gap-2"
                  >
                    <Server className="size-4" />
                    <span>Generate VOSS Configuration</span>
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="from-subnet-slicer" className="space-y-6">
              <div className="glass-panel p-6 space-y-4 animate-fade-in">
                <h3 className="text-lg font-medium">Subnets from Subnet Slicer</h3>
                
                {subnets.length > 0 ? (
                  <div className="space-y-4">
                    <p>Configure settings for the VOSS configuration based on the imported subnets.</p>
                    
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="ip-selection-imported" 
                        checked={useFirstIps} 
                        onCheckedChange={setUseFirstIps}
                      />
                      <Label htmlFor="ip-selection-imported">
                        {useFirstIps 
                          ? "Use first 3 IPs of each subnet for interfaces" 
                          : "Use last 3 IPs of each subnet for interfaces"
                        }
                      </Label>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-muted/50 rounded-md text-center">
                    <p>No subnets have been imported from Subnet Slicer.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Go to the Subnet Slicer, divide a subnet, and click "Create VOSS VRRP Configuration" 
                      to import subnets.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {hasCalculated && subnets.length > 0 && (
            <div className="space-y-4 glass-panel p-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Server className="size-5" />
                  Extreme Networks VOSS Configuration
                </h3>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={generateConfig}
                  className="gap-2"
                >
                  <Download className="size-4" />
                  Download Config
                </Button>
              </div>

              <div className="border border-border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="p-2 text-left font-medium">Subnet</th>
                      <th className="p-2 text-left font-medium">VLAN ID</th>
                      <th className="p-2 text-left font-medium">Custom VLAN ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {subnets.map((subnet, index) => (
                      <tr key={index} className="bg-card/50">
                        <td className="p-2 font-mono">{subnet.subnet}</td>
                        <td className="p-2">{vlanIds[index] || (index + 1)}</td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={1}
                            max={4094}
                            placeholder={`VLAN ID (1-4094)`}
                            value={vlanIds[index] || ''}
                            onChange={(e) => handleVlanIdChange(index, e.target.value)}
                            className="w-32 h-8"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-muted-foreground pt-2">
                <p><strong>Note:</strong> Extreme Networks VOSS supports VLAN IDs from 1 to 4094.</p>
                <p>The configuration will include VLAN creation, interface IP addresses, and VRRP setup for high availability.</p>
              </div>
            </div>
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

export default VOSSConfig;
