
import React, { useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Separator } from "@/components/ui/separator";
import Logo from '@/components/Logo';
import SubnetForm from '@/components/SubnetForm';
import SubnetResult from '@/components/SubnetResult';
import { divideSubnet } from '@/lib/subnetUtils';
import { Network, Github } from 'lucide-react';

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

  const handleCalculate = (subnet: string, divisions: number) => {
    try {
      const results = divideSubnet(subnet, divisions);
      setSubnets(results);
      setOriginalSubnet(subnet);
      setHasCalculated(true);
    } catch (error) {
      console.error('Calculation error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col theme-transition">
      <header className="w-full max-w-7xl mx-auto flex justify-between items-center p-6">
        <Logo />
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
          <SubnetForm onCalculate={handleCalculate} />
          
          {hasCalculated && (
            <SubnetResult 
              subnets={subnets} 
              originalSubnet={originalSubnet}
            />
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
