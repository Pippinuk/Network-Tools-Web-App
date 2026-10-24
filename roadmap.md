# PAN-OS manual rule authoring

- [x] Add rule editor and display-only example alongside CSV import.
- [x] Apply and test requested defaults across both input methods.
- [x] Verify adding, editing, deleting and exporting rules in the application.

# PAN-OS rule safety checks

- [x] Remove the UI App-ID any default and require explicit input.
- [x] Warn beneath the five requested fields when any is present, without blocking intentional any rules.
- [x] Test defaults and warnings; verify rule creation and output in the application.
- [x] Show broad-scope "any" as a greyed hint only, require an entry in the warned fields, and colour warnings red.