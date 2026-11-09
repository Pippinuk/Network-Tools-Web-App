# Architecture rules

- PAN-OS manual rule drafts require explicit entries for rule name, zones, addresses and App-ID before CSV normalization; broad-scope fields stay blank with a greyed "any" hint rather than a pre-filled value, and warnings stay in the draft helpers so they never mutate authored values or generated output.
- Keep the PAN-OS illustrative example separate from the authored rule collection so it cannot enter generated outputs.
- Resolve VOSS VRFs per VLAN with a shared GlobalRouter fallback; associate named VRFs before interface addresses and scope DHCP paths to that VRF, leaving Layer 2-only output unchanged. Named VRFs must already exist because creating them requires additional fabric settings.
- Read VOSS CSV columns by header when present, retaining positional legacy imports so optional routing columns do not shift existing fields.