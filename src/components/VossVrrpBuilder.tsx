import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertTriangle,
  Copy,
  Download,
  FileSpreadsheet,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  CSV_TEMPLATE,
  IsidMode,
  IsidOptions,
  VlanRow,
  VrrpOptions,
  buildVlanIdRange,
  computeIsid,
  generateVossVrrpConfig,
  getSubnetAddressing,
  parseNumberList,
  parseVlanCsv,
  rowsToCsv,
  splitSupernet,
  validateRows,
} from '@/lib/vossUtils';
import { isValidSubnet } from '@/lib/subnetUtils';
import { downloadFile } from '@/lib/exportUtils';

type Mode = 'auto' | 'manual' | 'csv';

const defaultIsid: IsidOptions = { mode: 'offset', base: 10000, prefix: 1 };

const defaultVrrp: VrrpOptions = {
  useFirstIps: true,
  switchCount: 2,
  priority: 200,
  backupMaster: true,
  memberPorts: '1/1-1/48',
  dhcpEnabled: false,
  dhcpServers: ['', '', ''],
};

const VossVrrpBuilder: React.FC = () => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>('auto');
  const [rows, setRows] = useState<VlanRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  // auto / split inputs
  const [supernet, setSupernet] = useState('10.10.0.0/16');
  const [subnetPrefix, setSubnetPrefix] = useState('24');
  const [startVlan, setStartVlan] = useState('100');
  const [vlanCount, setVlanCount] = useState('10');
  const [excluded, setExcluded] = useState('');
  const [namePattern, setNamePattern] = useState('VLAN-{id}');

  // I-SID + VRRP options
  const [isid, setIsid] = useState<IsidOptions>(defaultIsid);
  const [vrrp, setVrrp] = useState<VrrpOptions>(defaultVrrp);
  const [mltId, setMltId] = useState('');

  // Import subnets handed over from the Subnet Slicer
  useEffect(() => {
    const raw = sessionStorage.getItem('vossImport');
    if (!raw) return;
    sessionStorage.removeItem('vossImport');

    try {
      const payload = JSON.parse(raw) as {
        subnets?: string[];
        startingVlanId?: number;
        excludedVlans?: string;
        source?: string;
      };
      const list = (payload.subnets ?? []).filter(Boolean);
      if (!list.length) return;

      const start = payload.startingVlanId && payload.startingVlanId >= 2 ? payload.startingVlanId : 2;
      const excludedList = parseNumberList(payload.excludedVlans ?? '');
      const ids = buildVlanIdRange(start, list.length, excludedList);

      const imported: VlanRow[] = list.map((subnet, index) => {
        const id = ids[index] ?? start + index;
        return {
          vlanId: id,
          name: `VLAN-${id}`,
          subnet,
          isid: computeIsid(id, defaultIsid),
        };
      });

      setRows(imported);
      setCsvErrors([]);
      setMode('manual');
      setStartVlan(String(start));
      setExcluded(payload.excludedVlans ?? '');
      toast({
        title: 'Subnets imported',
        description: `${imported.length} subnets from the Subnet Slicer${payload.source ? ` (${payload.source})` : ''} loaded.`,
      });
    } catch {
      // ignore malformed payloads
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const errors = useMemo(() => validateRows(rows), [rows]);

  const options: VrrpOptions = useMemo(
    () => ({ ...vrrp, mltId: mltId.trim() ? parseInt(mltId, 10) : undefined }),
    [vrrp, mltId]
  );

  const config = useMemo(
    () => (rows.length && errors.length === 0 ? generateVossVrrpConfig(rows, options) : ''),
    [rows, errors, options]
  );

  const buildName = (id: number, index: number) =>
    namePattern
      .replace(/\{id\}/g, String(id))
      .replace(/\{n\}/g, String(index + 1))
      .slice(0, 32) || `VLAN-${id}`;

  const handleGenerate = () => {
    try {
      const prefix = parseInt(subnetPrefix, 10);
      const count = parseInt(vlanCount, 10);
      const start = parseInt(startVlan, 10);

      if (!isValidSubnet(supernet)) throw new Error('Enter a valid supernet in CIDR notation');
      if (isNaN(prefix) || prefix < 8 || prefix > 30) throw new Error('Subnet size must be between /8 and /30');
      if (isNaN(count) || count < 1 || count > 512) throw new Error('VLAN count must be between 1 and 512');
      if (isNaN(start) || start < 2 || start > 4094) throw new Error('Starting VLAN ID must be between 2 and 4094');

      const subnets = splitSupernet(supernet, prefix, count);
      if (subnets.length < count) {
        throw new Error(`${supernet} only provides ${subnets.length} x /${prefix} subnets`);
      }
      const ids = buildVlanIdRange(start, count, parseNumberList(excluded));
      if (ids.length < count) throw new Error('Not enough usable VLAN IDs in range');

      const next: VlanRow[] = ids.map((id, index) => ({
        vlanId: id,
        name: buildName(id, index),
        subnet: subnets[index],
        isid: computeIsid(id, isid),
      }));

      setRows(next);
      setCsvErrors([]);
      toast({ title: 'VLANs generated', description: `${next.length} VLANs with subnets and I-SIDs created.` });
    } catch (error) {
      toast({
        title: 'Unable to generate',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleAddRow = () => {
    const lastId = rows.length ? rows[rows.length - 1].vlanId : parseInt(startVlan, 10) - 1 || 99;
    const nextId = buildVlanIdRange(lastId + 1, 1, parseNumberList(excluded))[0] ?? lastId + 1;
    setRows([
      ...rows,
      { vlanId: nextId, name: `VLAN-${nextId}`, subnet: '', isid: computeIsid(nextId, isid) },
    ]);
  };

  const updateRow = (index: number, patch: Partial<VlanRow>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));

  const reapplyIsids = () => {
    setRows((prev) => prev.map((row) => ({ ...row, isid: computeIsid(row.vlanId, isid) })));
    toast({ title: 'I-SIDs recalculated' });
  };

  const handleCsv = async (file: File) => {
    const text = await file.text();
    const result = parseVlanCsv(text, isid);
    setRows(result.rows);
    setCsvErrors(result.errors);
    toast({
      title: 'CSV imported',
      description: `${result.rows.length} VLANs loaded${result.errors.length ? `, ${result.errors.length} rows skipped` : ''}.`,
      variant: result.rows.length ? 'default' : 'destructive',
    });
  };

  const downloadConfig = () => {
    if (!config) return;
    downloadFile(config, 'voss-vlan-isid-vrrp.cfg', 'text/plain');
    toast({ title: 'Configuration downloaded' });
  };

  const copyConfig = async () => {
    if (!config) return;
    await navigator.clipboard.writeText(config);
    toast({ title: 'Configuration copied to clipboard' });
  };

  return (
    <div className="space-y-6">
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="auto" className="gap-2">
            <Wand2 className="size-4" /> Auto generate
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2">
            <Plus className="size-4" /> Manual VLANs
          </TabsTrigger>
          <TabsTrigger value="csv" className="gap-2">
            <Upload className="size-4" /> CSV import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="auto" className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="supernet">Supernet (CIDR)</Label>
              <Input id="supernet" value={supernet} onChange={(e) => setSupernet(e.target.value)} placeholder="10.10.0.0/16" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subnetPrefix">Subnet size (/prefix)</Label>
              <Input id="subnetPrefix" type="number" min={8} max={30} value={subnetPrefix} onChange={(e) => setSubnetPrefix(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vlanCount">Number of VLANs</Label>
              <Input id="vlanCount" type="number" min={1} max={512} value={vlanCount} onChange={(e) => setVlanCount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startVlan">Starting VLAN ID</Label>
              <Input id="startVlan" type="number" min={2} max={4094} value={startVlan} onChange={(e) => setStartVlan(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="excluded">Excluded VLAN IDs</Label>
              <Input id="excluded" value={excluded} onChange={(e) => setExcluded(e.target.value)} placeholder="100,200,300-310" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="namePattern">VLAN name pattern</Label>
              <Input id="namePattern" value={namePattern} onChange={(e) => setNamePattern(e.target.value)} placeholder="VLAN-{id}" />
              <p className="text-xs text-muted-foreground">{'Use {id} for the VLAN ID and {n} for the sequence number'}</p>
            </div>
          </div>
          <Button onClick={handleGenerate} className="gap-2">
            <Sparkles className="size-4" /> Generate VLANs, subnets &amp; I-SIDs
          </Button>
        </TabsContent>

        <TabsContent value="manual" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Add each VLAN with its own subnet. I-SIDs are filled automatically from the rules below and can be overridden per row.
          </p>
          <Button variant="outline" onClick={handleAddRow} className="gap-2">
            <Plus className="size-4" /> Add VLAN
          </Button>
        </TabsContent>

        <TabsContent value="csv" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a CSV with the columns <span className="font-mono">vlan_id, vlan_name, subnet, isid</span>. Leave the I-SID blank to auto-generate it.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCsv(file);
                e.target.value = '';
              }}
            />
            <Button onClick={() => fileRef.current?.click()} className="gap-2">
              <Upload className="size-4" /> Upload CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadFile(CSV_TEMPLATE, 'voss-vlan-template.csv', 'text/csv')}
              className="gap-2"
            >
              <FileSpreadsheet className="size-4" /> Download template
            </Button>
          </div>
          {csvErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Some rows were skipped</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4 text-sm">
                  {csvErrors.slice(0, 8).map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-border p-4">
          <h4 className="font-medium">I-SID allocation</h4>
          <div className="flex gap-2">
            {(['offset', 'prefix'] as IsidMode[]).map((m) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={isid.mode === m ? 'default' : 'outline'}
                onClick={() => setIsid({ ...isid, mode: m })}
              >
                {m === 'offset' ? 'Base + VLAN ID' : 'Prefix + VLAN ID'}
              </Button>
            ))}
          </div>
          {isid.mode === 'offset' ? (
            <div className="space-y-2">
              <Label htmlFor="isidBase">I-SID base</Label>
              <Input
                id="isidBase"
                type="number"
                min={0}
                value={isid.base}
                onChange={(e) => setIsid({ ...isid, base: parseInt(e.target.value, 10) || 0 })}
              />
              <p className="text-xs text-muted-foreground">I-SID = base + VLAN ID (e.g. {isid.base} + 100 = {isid.base + 100})</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="isidPrefix">I-SID prefix</Label>
              <Input
                id="isidPrefix"
                type="number"
                min={1}
                max={1677}
                value={isid.prefix}
                onChange={(e) => setIsid({ ...isid, prefix: parseInt(e.target.value, 10) || 1 })}
              />
              <p className="text-xs text-muted-foreground">
                I-SID = prefix followed by the VLAN ID (e.g. {isid.prefix}0100 for VLAN 100)
              </p>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={reapplyIsids} disabled={!rows.length}>
            Recalculate I-SIDs
          </Button>
        </div>

        <div className="space-y-4 rounded-lg border border-border p-4">
          <h4 className="font-medium">VRRP &amp; interface options</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="switchCount">Switches in cluster</Label>
              <Input
                id="switchCount"
                type="number"
                min={1}
                max={4}
                value={vrrp.switchCount}
                onChange={(e) => setVrrp({ ...vrrp, switchCount: parseInt(e.target.value, 10) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Master VRRP priority</Label>
              <Input
                id="priority"
                type="number"
                min={1}
                max={255}
                value={vrrp.priority}
                onChange={(e) => setVrrp({ ...vrrp, priority: parseInt(e.target.value, 10) || 100 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="memberPorts">VLAN member ports</Label>
              <Input
                id="memberPorts"
                value={vrrp.memberPorts}
                onChange={(e) => setVrrp({ ...vrrp, memberPorts: e.target.value })}
                placeholder="1/1-1/48"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mltId">MLT / SMLT ID (optional)</Label>
              <Input id="mltId" value={mltId} onChange={(e) => setMltId(e.target.value)} placeholder="e.g. 1" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="useFirstIps"
              checked={vrrp.useFirstIps}
              onCheckedChange={(checked) => setVrrp({ ...vrrp, useFirstIps: checked })}
            />
            <Label htmlFor="useFirstIps">
              {vrrp.useFirstIps ? 'Gateway uses the first IPs of each subnet' : 'Gateway uses the last IPs of each subnet'}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="backupMaster"
              checked={vrrp.backupMaster}
              onCheckedChange={(checked) => setVrrp({ ...vrrp, backupMaster: checked })}
            />
            <Label htmlFor="backupMaster">Enable VRRP backup-master</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="dhcpEnabled"
              checked={!!vrrp.dhcpEnabled}
              onCheckedChange={(checked) => setVrrp({ ...vrrp, dhcpEnabled: checked })}
            />
            <Label htmlFor="dhcpEnabled">Enable DHCP relay on each VLAN interface</Label>
          </div>
          {vrrp.dhcpEnabled && (
            <div className="grid gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => {
                const value = (vrrp.dhcpServers || [])[i] || '';
                const invalid = value.trim().length > 0 && !isValidIpv4(value);
                return (
                  <div key={i} className="space-y-2">
                    <Label htmlFor={`dhcpServer${i}`}>DHCP server {i + 1}{i === 0 ? '' : ' (optional)'}</Label>
                    <Input
                      id={`dhcpServer${i}`}
                      value={value}
                      placeholder="e.g. 10.0.0.10"
                      onChange={(e) => {
                        const next = [...(vrrp.dhcpServers || ['', '', ''])];
                        next[i] = e.target.value;
                        setVrrp({ ...vrrp, dhcpServers: next });
                      }}
                    />
                    {invalid && <p className="text-xs text-destructive">Enter a valid IPv4 address</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-medium">{rows.length} VLANs</h4>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleAddRow} className="gap-2">
                <Plus className="size-4" /> Add VLAN
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadFile(rowsToCsv(rows, vrrp.useFirstIps), 'voss-vlan-plan.csv', 'text/csv')}
                className="gap-2"
              >
                <FileSpreadsheet className="size-4" /> Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRows([])} className="gap-2">
                <Trash2 className="size-4" /> Clear
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-24">VLAN ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Subnet (CIDR)</TableHead>
                  <TableHead className="w-32">I-SID</TableHead>
                  <TableHead>Gateway VIP</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => {
                  const vip = isValidSubnet(row.subnet)
                    ? getSubnetAddressing(row.subnet, vrrp.useFirstIps, vrrp.switchCount).virtualIp
                    : '—';
                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 w-20"
                          value={row.vlanId}
                          onChange={(e) => updateRow(index, { vlanId: parseInt(e.target.value, 10) || 0 })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8"
                          value={row.name}
                          onChange={(e) => updateRow(index, { name: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 font-mono"
                          value={row.subnet}
                          placeholder="10.10.100.0/24"
                          onChange={(e) => updateRow(index, { subnet: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 w-28"
                          value={row.isid}
                          onChange={(e) => updateRow(index, { isid: parseInt(e.target.value, 10) || 0 })}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{vip}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeRow(index)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Fix these before generating the configuration</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4 text-sm">
                  {errors.slice(0, 8).map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {config && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-medium">VOSS configuration preview</h4>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyConfig} className="gap-2">
                    <Copy className="size-4" /> Copy
                  </Button>
                  <Button size="sm" onClick={downloadConfig} className="gap-2">
                    <Download className="size-4" /> Download config
                  </Button>
                </div>
              </div>
              <Textarea readOnly value={config} className="h-96 font-mono text-xs" />
            </div>
          )}
        </div>
      )}

      <p className="flex items-center gap-1 text-xs text-amber-500">
        <AlertTriangle className="size-3.5" />
        VLAN ID 4048 and 4060-4094 are reserved by VOSS and are skipped automatically.
      </p>
    </div>
  );
};

export default VossVrrpBuilder;
