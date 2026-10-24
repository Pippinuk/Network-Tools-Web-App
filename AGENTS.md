# Architecture rules

- PAN-OS manual rule drafts require explicit App-ID input before CSV normalization; keep field safety warnings in the draft helpers so warnings never mutate authored values or generated output.
- Keep the PAN-OS illustrative example separate from the authored rule collection so it cannot enter generated outputs.