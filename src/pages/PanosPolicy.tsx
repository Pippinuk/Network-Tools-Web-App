import React from 'react';
import { Separator } from '@/components/ui/separator';
import Logo from '@/components/Logo';
import Navigation from '@/components/Navigation';
import PanosPolicyBuilder from '@/components/PanosPolicyBuilder';
import { Shield } from 'lucide-react';

const PanosPolicy = () => (
  <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col theme-transition">
    <header className="w-full max-w-7xl mx-auto flex justify-between items-center p-6">
      <div className="flex items-center">
        <Navigation />
        <Logo />
      </div>
    </header>

    <main className="flex-1 w-full max-w-6xl mx-auto p-6">
      <section className="mb-10 text-center">
        <div className="inline-flex items-center bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
          <Shield className="size-4 mr-2" />
          Palo Alto Networks PAN-OS
        </div>
        <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
          PAN-OS Security Policy Generator
        </h1>
        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
          Create App-ID based security rules or upload a CSV and convert them into ready-to-run Panorama or
          firewall API commands — XML API, REST API, raw XML, or Terraform HCL.
        </p>
      </section>

      <div className="glass-panel p-6">
        <PanosPolicyBuilder />
      </div>
    </main>

    <footer className="w-full max-w-7xl mx-auto p-6 mt-auto">
      <Separator className="mb-6" />
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-muted-foreground text-sm">
          <Logo iconClassName="size-4" textClassName="text-base" />
          <p>© {new Date().getFullYear()} SwitchCraft. All rights reserved.</p>
      </div>
    </footer>
  </div>
);

export default PanosPolicy;
