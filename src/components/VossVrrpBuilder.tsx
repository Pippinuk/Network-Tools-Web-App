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
  CSV_TEMPLATE_L2,
  IsidMode,
  IsidOptions,
  VridMode,
  VridOptions,
  MasterMode,
  computeMasterSwitch,
  defaultVridOptions,
  computeVrid,
  isValidVrid,
  VlanRow,
  VrrpOptions,
  isValidIpv4,
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

const vridModeLabels: Record<VridMode, string> = {
  vlan: 'VLAN ID',
  fixed: 'Fixed ID',
  parity: 'Odd / even VLAN',
  formula: 'Custom formula',
};

const defaultVrrp: VrrpOptions = {
  useFirstIps: true,
  switchCount: 2,
  priority: 200,
  backupMaster: true,
  memberPorts: '',
  dhcpEnabled: false,
  dhcpServers: ['', '', ''],
  masterMode: 'first',
};

const masterModeLabels: Record<MasterMode, string> = {
  alternate: 'Round-robin per VLAN',
  parity: 'Odd / even VLAN ID',
  first: 'All on switch 1',
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
  const [layer2Only, setLayer2Only] = useState(false);
  const [vrid, setVrid] = useState<VridOptions>(defaultVridOptions);

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

  const baseErrors = useMemo(() => validateRows(rows, layer2Only), [rows, layer2Only]);

  const masterMode: MasterMode = vrrp.masterMode ?? 'first';

  const effectiveMasters = useMemo(
    () =>
      rows.map(
        (row, index) =>
          row.masterSwitch ?? computeMasterSwitch(row.vlanId, index, vrrp.switchCount, masterMode)
      ),
    [rows, vrrp.switchCount, masterMode]
  );

  const options: VrrpOptions = useMemo(
    () => ({ ...vrrp, vrid, layer2Only, mltId: mltId.trim() ? parseInt(mltId, 10) : undefined }),
    [vrrp, vrid, mltId, layer2Only]
  );

  const effectiveVrids = useMemo(
    () => rows.map((row, index) => row.vrid ?? computeVrid(row.vlanId, index, vrid)),
    [rows, vrid]
  );

  const vridErrors = useMemo(() => {
    const list: string[] = [];
    if (layer2Only) return list;
    rows.forEach((row, index) => {
      const value = effectiveVrids[index];
      if (!isValidVrid(value)) {
        list.push(`VLAN ${row.vlanId}: VRRP instance ID "${isNaN(value) ? 'invalid formula' : value}" must be between 1 and 255`);
      }
    });
    return Array.from(new Set(list));
  }, [rows, effectiveVrids, layer2Only]);

  const errors = useMemo(() => Array.from(new Set([...baseErrors, ...vridErrors])), [baseErrors, vridErrors]);

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

      if (isNaN(count) || count < 1 || count > 512) throw new Error('VLAN count must be between 1 and 512');
      if (isNaN(start) || start < 2 || start > 4094) throw new Error('Starting VLAN ID must be between 2 and 4094');

      let subnets: string[] = [];
      if (!layer2Only) {
        if (!isValidSubnet(supernet)) throw new Error('Enter a valid supernet in CIDR notation');
        if (isNaN(prefix) || prefix < 8 || prefix > 30) throw new Error('Subnet size must be between /8 and /30');
        subnets = splitSupernet(supernet, prefix, count);
        if (subnets.length < count) {
          throw new Error(`${supernet} only provides ${subnets.length} x /${prefix} subnets`);
        }
      }
      const ids = buildVlanIdRange(start, count, parseNumberList(excluded));
      if (ids.length < count) throw new Error('Not enough usable VLAN IDs in range');

      const next: VlanRow[] = ids.map((id, index) => ({
        vlanId: id,
        name: buildName(id, index),
        subnet: subnets[index] ?? '',
        isid: computeIsid(id, isid),
      }));

      setRows(next);
      setCsvErrors([]);
      toast({ title: 'VLANs generated', description: layer2Only ? `${next.length} VLANs with I-SIDs created (layer 2 only).` : `${next.length} VLANs with subnets and I-SIDs created.` });
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
    const result = parseVlanCsv(text, isid, layer2Only);
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
    downloadFile(config, layer2Only ? 'voss-vlan-isid.cfg' : 'voss-vlan-isid-vrrp.cfg', 'text/plain');
    toast({ title: 'Configuration downloaded' });
  };

  const copyConfig = async () => {
    if (!config) return;
    await navigator.clipboard.writeText(config);
    toast({ title: 'Configuration copied to clipboard' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
        <div>
          <Label htmlFor="layer2Only" className="text-base">Layer 2 only (VLAN + I-SID)</Label>
          <p className="text-xs text-muted-foreground">
            Create VLANs and assign I-SIDs with no IP interface, no subnets and no VRRP configuration.
          </p>
        </div>
        <Switch id="layer2Only" checked={layer2Only} onCheckedChange={setLayer2Only} />
      </div>

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
            {!layer2Only && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="supernet">Supernet (CIDR)</Label>
                  <Input id="supernet" value={supernet} onChange={(e) => setSupernet(e.target.value)} placeholder="10.10.0.0/16" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subnetPrefix">Subnet size (/prefix)</Label>
                  <Input id="subnetPrefix" type="number" min={8} max={30} value={subnetPrefix} onChange={(e) => setSubnetPrefix(e.target.value)} />
                </div>
              </>
            )}
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
            <Sparkles className="size-4" /> {layer2Only ? 'Generate VLANs & I-SIDs' : 'Generate VLANs, subnets & I-SIDs'}
          </Button>
        </TabsContent>

        <TabsContent value="manual" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            {layer2Only ? 'Add each VLAN and its name. ' : 'Add each VLAN with its own subnet. '}I-SIDs are filled automatically from the rules below and can be overridden per row.
          </p>
          <Button variant="outline" onClick={handleAddRow} className="gap-2">
            <Plus className="size-4" /> Add VLAN
          </Button>
        </TabsContent>

        <TabsContent value="csv" className="mt-6 space-y-4">
          {layer2Only ? (
            <p className="text-sm text-muted-foreground">
              Upload a CSV with the columns <span className="font-mono">vlan_id, vlan_name, isid</span>. Leave the I-SID blank to
              auto-generate it. Subnet, VRRP and DHCP columns are ignored in layer 2 only mode.
            </p>
          ) : (
          <p className="text-sm text-muted-foreground">
            Upload a CSV with the columns{' '}
            <span className="font-mono">vlan_id, vlan_name, subnet, isid, vrid, master_switch, dhcp_enabled, dhcp_server_1, dhcp_server_2, dhcp_server_3</span>.
            Leave the I-SID or VRRP instance ID (vrid) blank to auto-generate them. Set <span className="font-mono">master_switch</span> to the
            switch number (1, 2, ...) that should be VRRP master for that VLAN — blank follows the master distribution rule below. Set <span className="font-mono">dhcp_enabled</span> to yes/no per VLAN — blank falls back
            to the DHCP relay settings below.
          </p>
          )}
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
              onClick={() =>
                downloadFile(
                  layer2Only ? CSV_TEMPLATE_L2 : CSV_TEMPLATE,
                  layer2Only ? 'voss-vlan-l2-template.csv' : 'voss-vlan-template.csv',
                  'text/csv'
                )
              }
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
          <h4 className="font-medium">{layer2Only ? 'VLAN options' : 'VRRP & interface options'}</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            {!layer2Only && (
              <>
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
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="memberPorts">VLAN member ports (optional)</Label>
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

          {!layer2Only && (
            <>
          <div className="space-y-3 rounded-md border border-border p-3">
            <Label>VRRP instance ID (VRID) allocation</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(vridModeLabels) as VridMode[]).map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={vrid.mode === m ? 'default' : 'outline'}
                  onClick={() => setVrid({ ...vrid, mode: m })}
                >
                  {vridModeLabels[m]}
                </Button>
              ))}
            </div>

            {vrid.mode === 'vlan' && (
              <p className="text-xs text-muted-foreground">
                VRID follows the VLAN ID, wrapped into the valid 1-255 range (e.g. VLAN 100 → 100, VLAN 300 → 45).
              </p>
            )}

            {vrid.mode === 'fixed' && (
              <div className="space-y-2">
                <Label htmlFor="vridFixed">VRRP instance ID</Label>
                <Input
                  id="vridFixed"
                  type="number"
                  min={1}
                  max={255}
                  value={vrid.fixed}
                  onChange={(e) => setVrid({ ...vrid, fixed: parseInt(e.target.value, 10) || 1 })}
                />
                <p className="text-xs text-muted-foreground">The same VRID is used on every VLAN interface.</p>
              </div>
            )}

            {vrid.mode === 'parity' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vridOdd">VRID for odd VLAN IDs</Label>
                  <Input
                    id="vridOdd"
                    type="number"
                    min={1}
                    max={255}
                    value={vrid.oddVrid}
                    onChange={(e) => setVrid({ ...vrid, oddVrid: parseInt(e.target.value, 10) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vridEven">VRID for even VLAN IDs</Label>
                  <Input
                    id="vridEven"
                    type="number"
                    min={1}
                    max={255}
                    value={vrid.evenVrid}
                    onChange={(e) => setVrid({ ...vrid, evenVrid: parseInt(e.target.value, 10) || 1 })}
                  />
                </div>
              </div>
            )}

            {vrid.mode === 'formula' && (
              <div className="space-y-2">
                <Label htmlFor="vridFormula">VRID formula</Label>
                <Input
                  id="vridFormula"
                  className="font-mono"
                  value={vrid.formula}
                  onChange={(e) => setVrid({ ...vrid, formula: e.target.value })}
                  placeholder="{id} % 255 + 1"
                />
                <p className="text-xs text-muted-foreground">
                  {'Use {id} for the VLAN ID and {n} for the row number, with + - * / % ( ). Examples: {id} % 100, ({id} - 100) / 2 + 1, {n}.'}
                </p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Any VRID typed directly in the table below overrides this rule for that VLAN.
            </p>
          </div>
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-center gap-2">
              <Switch
                id="distributeMaster"
                checked={masterMode !== 'first'}
                disabled={vrrp.switchCount < 2}
                onCheckedChange={(checked) => setVrrp({ ...vrrp, masterMode: checked ? 'alternate' : 'first' })}
              />
              <Label htmlFor="distributeMaster">Split the VRRP master across switches</Label>
            </div>
            {vrrp.switchCount < 2 && (
              <p className="text-xs text-muted-foreground">Add a second switch to the cluster to balance VRRP masters.</p>
            )}
            {masterMode !== 'first' && vrrp.switchCount > 1 && (
              <div className="flex flex-wrap gap-2">
                {(['alternate', 'parity'] as MasterMode[]).map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={masterMode === m ? 'default' : 'outline'}
                    onClick={() => setVrrp({ ...vrrp, masterMode: m })}
                  >
                    {masterModeLabels[m]}
                  </Button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              The master switch keeps the full priority ({vrrp.priority}); the other switches drop 20 per step. Pick a master per VLAN in
              the table below to override this rule.
            </p>
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
            </>
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
                onClick={() =>
                  downloadFile(rowsToCsv(rows, vrrp.useFirstIps, layer2Only), 'voss-vlan-plan.csv', 'text/csv')
                }
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
                  {!layer2Only && <TableHead>Subnet (CIDR)</TableHead>}
                  <TableHead className="w-32">I-SID</TableHead>
                  {!layer2Only && (
                    <>
                      <TableHead className="w-24">VRID</TableHead>
                      <TableHead className="w-40">VRRP master</TableHead>
                      <TableHead>Gateway VIP</TableHead>
                    </>
                  )}
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
                      {!layer2Only && (
                        <TableCell>
                          <Input
                            className="h-8 font-mono"
                            value={row.subnet}
                            placeholder="10.10.100.0/24"
                            onChange={(e) => updateRow(index, { subnet: e.target.value })}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 w-28"
                          value={row.isid}
                          onChange={(e) => updateRow(index, { isid: parseInt(e.target.value, 10) || 0 })}
                        />
                      </TableCell>
                      {!layer2Only && (
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          max={255}
                          className="h-8 w-20"
                          value={row.vrid ?? ''}
                          placeholder={String(effectiveVrids[index] ?? '')}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            updateRow(index, { vrid: raw === '' ? undefined : parseInt(raw, 10) });
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Array.from({ length: Math.max(1, vrrp.switchCount) }, (_, i) => i + 1).map((sw) => (
                            <Button
                              key={sw}
                              type="button"
                              size="sm"
                              className="h-8 w-8 p-0"
                              variant={effectiveMasters[index] === sw ? 'default' : 'outline'}
                              onClick={() =>
                                updateRow(index, { masterSwitch: row.masterSwitch === sw ? undefined : sw })
                              }
                            >
                              {sw}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{vip}</TableCell>
                      </>
                      )}
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
