import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Save } from 'lucide-react';
import { PanosRuleDraft } from '@/lib/panosRuleEditor';
import { PanosRule } from '@/lib/panosUtils';
import { parsePanosRuleDraft } from '@/lib/panosRuleEditor';

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

const PanosRuleEditor = ({ draft, onChange, onSave, onCancel, editing }: Props) => {
  const [error, setError] = useState('');
  const update = (key: keyof PanosRuleDraft, value: string) => { setError(''); onChange({ ...draft, [key]: value }); };
  return (
    <form className="space-y-5" onSubmit={e => {
      e.preventDefault();
      const result = parsePanosRuleDraft(draft);
      const rule = result.rules[0];
      if (!rule || result.errors.length) { setError(result.errors.join(' ') || 'Enter a rule name.'); return; }
      setError(onSave(rule) || '');
    }}>
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        {groups.map(group => (
          <fieldset key={group.title} className="min-w-0 space-y-3">
            <legend className="mb-2 text-sm font-semibold">{group.title}</legend>
            {group.fields.map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`rule-${key}`}>{label}</Label>
                <Input id={`rule-${key}`} value={draft[key]} required={key === 'rule_name'}
                  placeholder={key === 'rule_name' ? 'Allow-Corporate-Web' : undefined}
                  onChange={e => update(key, e.target.value)} />
              </div>
            ))}
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
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="gap-2">{editing ? <Save className="size-4" /> : <Plus className="size-4" />}{editing ? 'Save rule' : 'Add rule'}</Button>
        <Button type="button" variant="outline" onClick={() => { setError(''); onCancel(); }}>{editing ? 'Cancel edit' : 'Reset fields'}</Button>
      </div>
    </form>
  );
};

export default PanosRuleEditor;