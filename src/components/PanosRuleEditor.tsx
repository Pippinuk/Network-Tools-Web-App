import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Plus, Save } from 'lucide-react';
import { PanosRuleDraft } from '@/lib/panosRuleEditor';
import { PanosRule } from '@/lib/panosUtils';
import { PANOS_ANY_HINT_FIELDS, PANOS_REQUIRED_FIELDS, getPanosFieldWarning, parsePanosRuleDraft } from '@/lib/panosRuleEditor';

interface Props {
  draft: PanosRuleDraft;
  onChange: (draft: PanosRuleDraft) => void;
  onSave: (rule: PanosRule) => string | void;
  onCancel: () => void;
  editing: boolean;
}

const groups: { title: string; fields: [keyof PanosRuleDraft, string][] }[] = [
  { title: 'Rule details', fields: [['rule_name', 'Rule name (required)'], ['description', 'Description'], ['tags', 'Tags']] },
  { title: 'Source', fields: [['source_zone', 'Source zones'], ['source_address', 'Source addresses'], ['source_user', 'Source users'], ['source_hip', 'Source HIP profiles']] },
  { title: 'Destination', fields: [['destination_zone', 'Destination zones'], ['destination_address', 'Destination addresses'], ['destination_hip', 'Destination HIP profiles']] },
  { title: 'Applications & services', fields: [['application', 'Applications (App-ID)'], ['service', 'Services'], ['url_category', 'URL categories']] },
  { title: 'Profiles & schedule', fields: [['profile_group', 'Security profile group'], ['log_setting', 'Log forwarding profile'], ['schedule', 'Schedule']] },
];
const flags: [keyof PanosRuleDraft, string][] = [
  ['log_start', 'Log at session start'], ['log_end', 'Log at session end'],
  ['disabled', 'Disabled'], ['negate_source', 'Negate source'], ['negate_destination', 'Negate destination'],
];

// Greyed hints only — they never become the field's value.
const hints: Partial<Record<keyof PanosRuleDraft, string>> = {
  rule_name: 'Allow-Corporate-Web',
  description: 'What this rule is for',
  tags: 'internet;approved',
  application: 'web-browsing;ssl',
  profile_group: 'Outbound-Security-Profiles',
  log_setting: 'default-log-profile',
};
const hintFor = (key: keyof PanosRuleDraft): string | undefined =>
  hints[key] ?? (PANOS_ANY_HINT_FIELDS.includes(key) ? 'any' : undefined);

const PanosRuleEditor = ({ draft, onChange, onSave, onCancel, editing }: Props) => {
  const [errors, setErrors] = useState<string[]>([]);
  const update = (key: keyof PanosRuleDraft, value: string) => { setErrors([]); onChange({ ...draft, [key]: value }); };
  return (
    <form className="space-y-5" noValidate onSubmit={e => {
      e.preventDefault();
      const result = parsePanosRuleDraft(draft);
      const rule = result.rules[0];
      if (!rule || result.errors.length) { setErrors(result.errors.length ? result.errors : ['Enter a rule name.']); return; }
      const problem = onSave(rule);
      setErrors(problem ? [problem] : []);
    }}>
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        {groups.map(group => (
          <fieldset key={group.title} className="min-w-0 space-y-3">
            <legend className="mb-2 text-sm font-semibold">{group.title}</legend>
            {group.fields.map(([key, label]) => {
              const warning = getPanosFieldWarning(key, draft[key]);
              return (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`rule-${key}`}>{label}</Label>
                  <Input id={`rule-${key}`} value={draft[key]} required={PANOS_REQUIRED_FIELDS.includes(key)}
                    aria-invalid={warning ? true : undefined}
                    aria-describedby={warning ? `rule-${key}-warning` : undefined}
                    placeholder={hintFor(key)}
                    onChange={e => update(key, e.target.value)} />
                  {warning && <p id={`rule-${key}-warning`} role="status" className="flex items-start gap-1.5 text-xs font-medium text-destructive">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                    <span>{warning}</span>
                  </p>}
                </div>
              );
            })}
          </fieldset>
        ))}
        <fieldset className="space-y-3 min-w-0">
          <legend className="mb-2 text-sm font-semibold">Action & options</legend>
          {([
            ['rule_type', 'Rule type', ['universal', 'interzone', 'intrazone']],
            ['action', 'Action', ['allow', 'deny', 'drop', 'reset-client', 'reset-server', 'reset-both']],
          ] as [keyof PanosRuleDraft, string, string[]][]).map(([key, label, values]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`rule-${key}`}>{label}</Label>
              <Select value={draft[key]} onValueChange={value => update(key, value)}>
                <SelectTrigger id={`rule-${key}`}><SelectValue /></SelectTrigger>
                <SelectContent>{values.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ))}
          {flags.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <Label htmlFor={`rule-${key}`}>{label}</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-6">{draft[key]}</span>
                <Switch id={`rule-${key}`} checked={draft[key] === 'yes'} onCheckedChange={checked => update(key, checked ? 'yes' : 'no')} />
              </div>
            </div>
          ))}
        </fieldset>
      </div>
      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {errors.map(message => <li key={message}>{message}</li>)}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="gap-2">{editing ? <Save className="size-4" /> : <Plus className="size-4" />}{editing ? 'Save rule' : 'Add rule'}</Button>
        <Button type="button" variant="outline" onClick={() => { setErrors([]); onCancel(); }}>{editing ? 'Cancel edit' : 'Reset fields'}</Button>
      </div>
    </form>
  );
};

export default PanosRuleEditor;
