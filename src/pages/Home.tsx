import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import Navigation from '@/components/Navigation';
import { Network, Server, ArrowRight, Layers } from 'lucide-react';

const Home = () => {
  const navigate = useNavigate();

  const tools = [
    {
      id: 'subnet',
      title: 'Subnet Slicer',
      description: 'Divide IP subnets by VLAN count, target mask, or IP range. Export results as NetBox-ready CSV.',
      icon: Network,
      path: '/subnet',
      color: 'bg-primary/10 text-primary',
    },
    {
      id: 'voss',
      title: 'VOSS VLAN / I-SID / VRRP',
      description: 'Generate Extreme Networks VOSS configurations with VLANs, I-SIDs, and VRRP cluster settings.',
      icon: Server,
      path: '/voss',
      color: 'bg-emerald-500/10 text-emerald-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col theme-transition">
      <header className="w-full max-w-7xl mx-auto flex justify-between items-center p-6">
        <div className="flex items-center">
          <Navigation />
          <Logo />
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto p-6">
        <section className="mb-12 text-center animate-slide-down">
          <div className="max-w-3xl mx-auto space-y-5 py-12">
            <div className="inline-flex items-center bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
              <Layers className="size-4 mr-2" />
              Network Engineering Toolkit
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Welcome to NetworkTools
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              A simple, fast collection of utilities for network engineers. Slice subnets, plan VLANs,
              and generate Extreme Networks VOSS configuration — all from your browser.
            </p>
          </div>
        </section>

        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-2xl font-semibold tracking-tight mb-8">
            Choose a tool to get started
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => navigate(tool.path)}
                  className="group text-left glass-panel p-6 rounded-2xl transition-all duration-200 hover:shadow-lg hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl ${tool.color}`}>
                      <Icon className="size-7" />
                    </div>
                    <ArrowRight className="size-5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{tool.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {tool.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Not sure where to start?
            </p>
            <Button onClick={() => navigate('/subnet')} size="lg" className="gap-2">
              <Network className="size-4" />
              Open the Subnet Slicer
              <ArrowRight className="size-4" />
            </Button>
          </div>
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

export default Home;
