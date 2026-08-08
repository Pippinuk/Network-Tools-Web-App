import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  downloadFile,
  generateVlanIds,
  generateNetboxPrefixesCsv,
  generateNetboxVlansCsv,
} from '@/lib/exportUtils';
import { Download, Database, AlertTriangle } from 'lucide-react';
import SubnetResultTable from './SubnetResultTable';

interface NetboxExportGeneratorProps {
  subnets: Array<{
    subnet: string;
    networkAddress: string;
    broadcastAddress: string;
    firstUsableHost: string;
    lastUsableHost: string;
    hostsCount: number;
  }>;
  originalSubnet: string;
}

const parseExcludedVlans = (input: string): number[] => {
  if (!input.trim()) return [];
  return input
    .split(',')
    .map((p) => parseInt(p.trim(), 10))
    .filter((n) => !isNaN(n));
};

const NetboxExportGenerator: React.FC<NetboxExportGeneratorProps> = ({ subnets, originalSubnet }) => {
  const [vlanIds, setVlanIds] = useState<Record<number, number>>({});
  const [vlanNames, setVlanNames] = useState<Record<number, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    const refresh = () => {
      const startVlanId = parseInt(sessionStorage.getItem('startingVlanId') || '2', 10);
      const excluded = parseExcludedVlans(sessionStorage.getItem('excludedVlans') || '');
      if (!isNaN(startVlanId) && startVlanId > 0 && startVlanId <= 4094) {
        setVlanIds(generateVlanIds(startVlanId, subnets.length, excluded));
      }
    };
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('sessionStorageChange', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('sessionStorageChange', refresh);
    };
  }, [subnets.length]);

  const handleVlanNameChange = (index: number, value: string) => {
    setVlanNames((prev) => {
      const next = { ...prev };
      if (value.trim()) next[index] = value.trim();
      else delete next[index];
      return next;
    });
  };

  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

  const exportPrefixes = () => {
    const csv = generateNetboxPrefixesCsv(subnets, vlanIds, vlanNames, originalSubnet);
    downloadFile(csv, `netbox-prefixes-${stamp()}.csv`, 'text/csv');
    toast({ title: "NetBox prefixes exported", description: `${subnets.length} prefixes ready for import.` });
  };

  const exportVlans = () => {
    const csv = generateNetboxVlansCsv(subnets, vlanIds, vlanNames);
    downloadFile(csv, `netbox-vlans-${stamp()}.csv`, 'text/csv');
    toast({ title: "NetBox VLANs exported", description: `${subnets.length} VLANs ready for import.` });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Database className="size-5" />
          NetBox CSV Export
        </h3>
        <div className="flex gap-2">
          <Button onClick={exportPrefixes} className="gap-2">
            <Download className="size-4" />
            Prefixes CSV
          </Button>
          <Button onClick={exportVlans} variant="secondary" className="gap-2">
            <Download className="size-4" />
            VLANs CSV
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Set VLAN IDs and names below, then download CSVs formatted for NetBox bulk import
        (IPAM &gt; Prefixes &gt; Import and IPAM &gt; VLANs &gt; Import).
      </p>

      <SubnetResultTable
        subnets={subnets}
        vlanIds={vlanIds}
        vlanNames={vlanNames}
        onVlanNameChange={handleVlanNameChange}
      />

      <div className="text-xs text-muted-foreground pt-2 space-y-1">
        <p className="flex items-center gap-1 text-amber-500">
          <AlertTriangle className="size-3.5" />
          <strong>Note:</strong> Import VLANs first if you want prefixes linked to VLANs by VID.
        </p>
        <p>Prefixes CSV columns: prefix, status, vlan_group, vlan, is_pool, description.</p>
        <p>VLANs CSV columns: vid, name, status, description.</p>
      </div>
    </div>
  );
};

export default NetboxExportGenerator;
