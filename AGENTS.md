# Architecture rules

- PAN-OS manual rule drafts require explicit entries for rule name, zones, addresses and App-ID before CSV normalization; broad-scope fields stay blank with a greyed "any" hint rather than a pre-filled value, and warnings stay in the draft helpers so they never mutate authored values or generated output.
- Keep the PAN-OS illustrative example separate from the authored rule collection so it cannot enter generated outputs.