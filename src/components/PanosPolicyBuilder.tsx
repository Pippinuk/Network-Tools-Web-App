import React, { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { downloadFile } from '@/lib/exportUtils';
import {
  generatePanosCsvTemplate,
  parsePanosCsv,
  generateXmlApiCommands,
  generateRestApiCommands,
  generateBulkXml,
  PanosRule,
  PanosTargetOptions,
  PanosPlacement,
  PanosPlacementMode,
} from '@/lib/panosUtils';
import {
  AlertTriangle,
  Copy,
  Download,
  FileSpreadsheet,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';

const PanosPolicyBuilder: React.FC = () => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rules, setRules] = useState<PanosRule[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');

  const [usePanorama, setUsePanorama] = useState(true);
  const [host, setHost] = useState('');
  const [deviceGroup, setDeviceGroup] = useState('Branch-Firewalls');
  const [postRulebase, setPostRulebase] = useState(false);
  const [vsys, setVsys] = useState('vsys1');
  const [apiVersion, setApiVersion] = useState('v11.0');

  const [placementEnabled, setPlacementEnabled] = useState(false);
  const [placementMode, setPlacementMode] = useState<'top' | 'bottom' | 'after'>('after');
  const [afterRule, setAfterRule] = useState('');

  const options: PanosTargetOptions = {
    target: usePanorama ? 'panorama' : 'firewall',
    host: host.trim(),
    deviceGroup: deviceGroup.trim() || 'DeviceGroup',
    rulebase: postRulebase ? 'post-rulebase' : 'pre-rulebase',
    vsys: vsys.trim() || 'vsys1',
    apiKeyPlaceholder: '{api_key}',
  };

  const placement: PanosPlacement = {
    mode: placementEnabled ? placementMode : 'none',
    afterRule: afterRule.trim(),
  };

  const xmlApi = useMemo(
    () => (rules.length ? generateXmlApiCommands(rules, options, placement) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rules, usePanorama, host, deviceGroup, postRulebase, vsys, placementEnabled, placementMode, afterRule]
  );
  const restApi = useMemo(
    () => (rules.length ? generateRestApiCommands(rules, options, apiVersion) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rules, usePanorama, host, deviceGroup, postRulebase, vsys, apiVersion]
  );
  const bulkXml = useMemo(() => (rules.length ? generateBulkXml(rules) : ''), [rules]);

  const handleTemplate = () => {
    downloadFile(generatePanosCsvTemplate(), 'panos-security-rules-template.csv', 'text/csv');
    toast({ title: 'Template downloaded', description: 'panos-security-rules-template.csv' });
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    const result = parsePanosCsv(text);
    setRules(result.rules);
    setErrors(result.errors);
    setFileName(file.name);
    toast({
      title: result.rules.length ? 'CSV imported' : 'Nothing imported',
      description: `${result.rules.length} rule(s) parsed${result.errors.length ? `, ${result.errors.length} warning(s)` : ''}.`,
      variant: result.rules.length ? 'default' : 'destructive',
    });
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: `${label} copied to clipboard.` });
    } catch {
      toast({ title: 'Copy failed', description: 'Use the download button instead.', variant: 'destructive' });
    }
  };

  const clearAll = () => {
    setRules([]);
    setErrors([]);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-8">
      {/* Step 1 - CSV */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileSpreadsheet className="size-5" />
          1. Upload your rule definitions
        </h2>
        <p className="text-sm text-muted-foreground">
          Start from the template — it contains every field needed to build App-ID based security
          rules. Use a semicolon (;) to separate multiple values inside one field.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="gap-2" onClick={handleTemplate}>
            <Download className="size-4" />
            Download CSV template
          </Button>
          <Button className="gap-2" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            Upload CSV
          </Button>
          {rules.length > 0 && (
            <Button variant="ghost" className="gap-2" onClick={clearAll}>
              <Trash2 className="size-4" />
              Clear
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
        {fileName && (
          <p className="text-sm text-muted-foreground">
            Loaded <strong>{fileName}</strong> — {rules.length} rule(s).
          </p>
        )}
        {errors.length > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm space-y-1">
            <p className="flex items-center gap-2 font-medium text-amber-600">
              <AlertTriangle className="size-4" /> Import warnings
            </p>
            <ul className="list-disc pl-6 text-muted-foreground">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Step 2 - target */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="size-5" />
          2. Target
        </h2>
        <div className="flex items-center gap-3">
          <Switch id="panorama" checked={usePanorama} onCheckedChange={setUsePanorama} />
          <Label htmlFor="panorama">
            {usePanorama ? 'Panorama (device group)' : 'Direct to PAN-OS firewall (vsys)'}
          </Label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="host">Panorama / firewall hostname or IP</Label>
            <Input
              id="host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="panorama.example.com"
            />
          </div>
          {usePanorama ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="dg">Device group</Label>
                <Input id="dg" value={deviceGroup} onChange={(e) => setDeviceGroup(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Rulebase</Label>
                <div className="flex items-center gap-3 h-10">
                  <Switch id="rb" checked={postRulebase} onCheckedChange={setPostRulebase} />
                  <Label htmlFor="rb" className="font-normal">
                    {postRulebase ? 'Post-rulebase' : 'Pre-rulebase'}
                  </Label>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="vsys">Virtual system</Label>
              <Input id="vsys" value={vsys} onChange={(e) => setVsys(e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="apiv">REST API version</Label>
            <Input id="apiv" value={apiVersion} onChange={(e) => setApiVersion(e.target.value)} />
          </div>
        </div>

        {/* Rule placement */}
        <div className="space-y-3 rounded-md border border-border/60 p-4">
          <div className="flex items-center gap-3">
            <Switch id="placement" checked={placementEnabled} onCheckedChange={setPlacementEnabled} />
            <Label htmlFor="placement">Place rules at a specific position in the rulebase</Label>
          </div>
          {placementEnabled && (
            <>
              <p className="text-xs text-muted-foreground">
                Positioning is applied via the XML API <code>type=op</code> move command, so it is
                included in the <strong>XML API</strong> output only.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Placement</Label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { v: 'after', label: 'After rule' },
                        { v: 'top', label: 'Top' },
                        { v: 'bottom', label: 'Bottom' },
                      ] as { v: PanosPlacementMode; label: string }[]
                    ).map((o) => (
                      <Button
                        key={o.v}
                        type="button"
                        size="sm"
                        variant={placementMode === o.v ? 'default' : 'outline'}
                        onClick={() => setPlacementMode(o.v as 'top' | 'bottom' | 'after')}
                      >
                        {o.label}
                      </Button>
                    ))}
                  </div>
                </div>
                {placementMode === 'after' && (
                  <div className="space-y-2">
                    <Label htmlFor="afterRule">Place all new rules after rule named</Label>
                    <Input
                      id="afterRule"
                      value={afterRule}
                      onChange={(e) => setAfterRule(e.target.value)}
                      placeholder="Existing-Rule-Name"
                    />
                  </div>
                )}
              </div>
              {placementMode === 'after' && !afterRule.trim() && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5" />
                  Enter the name of the existing rule to anchor the new rules after.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {/* Step 3 - preview */}
      {rules.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">3. Parsed rules</h2>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Applications</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Profiles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r, i) => (
                  <TableRow key={`${r.rule_name}-${i}`}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.rule_name}</TableCell>
                    <TableCell>{r.source_zone.join(', ')}</TableCell>
                    <TableCell>{r.destination_zone.join(', ')}</TableCell>
                    <TableCell>{r.source_address.join(', ')}</TableCell>
                    <TableCell>{r.destination_address.join(', ')}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{r.application.join(', ')}</TableCell>
                    <TableCell>{r.service.join(', ')}</TableCell>
                    <TableCell className="capitalize">{r.action}</TableCell>
                    <TableCell>{r.profile_group || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Step 4 - output */}
      {rules.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">4. Generated API commands</h2>
          <Tabs defaultValue="xml">
            <TabsList>
              <TabsTrigger value="xml">XML API (curl)</TabsTrigger>
              <TabsTrigger value="rest">REST API (curl)</TabsTrigger>
              <TabsTrigger value="raw">Raw XML</TabsTrigger>
            </TabsList>

            {[
              { key: 'xml', content: xmlApi, file: 'panos-xml-api-rules.sh', label: 'XML API commands' },
              { key: 'rest', content: restApi, file: 'panos-rest-api-rules.sh', label: 'REST API commands' },
              { key: 'raw', content: bulkXml, file: 'panos-security-rules.xml', label: 'Raw XML' },
            ].map((t) => (
              <TabsContent key={t.key} value={t.key} className="space-y-3">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => copy(t.content, t.label)}>
                    <Copy className="size-4" /> Copy
                  </Button>
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() =>
                      downloadFile(
                        t.content,
                        t.file,
                        t.key === 'raw' ? 'application/xml' : 'text/plain'
                      )
                    }
                  >
                    <Download className="size-4" /> Download
                  </Button>
                </div>
                <Textarea readOnly value={t.content} className="font-mono text-xs h-[420px]" />
              </TabsContent>
            ))}
          </Tabs>
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <AlertTriangle className="size-3.5 mt-0.5 text-amber-500" />
            Replace <code>{'{api_key}'}</code> with a valid API key before running. Always review the
            candidate configuration before committing.
          </p>
        </section>
      )}
    </div>
  );
};

export default PanosPolicyBuilder;
