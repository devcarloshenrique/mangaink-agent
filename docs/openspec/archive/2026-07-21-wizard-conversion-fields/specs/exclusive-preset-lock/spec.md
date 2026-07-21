## ADDED Requirements

### Requirement: Exclusive Preset Performs Complete Replacement

When a preset with `exclusive: true` is selected, `fieldOptions` SHALL be completely replaced (not merged) with the preset's values, and all other conversion fields SHALL be disabled.

`exclusive: true` means the preset's values are the only valid configuration — all other fields are ignored by the conversion engine and SHALL be non-interactive in the UI.

#### Scenario: Selecting "Sem Processamento" performs complete replacement
- **WHEN** the user selects the "Sem Processamento" preset
- **THEN** `fieldOptions` SHALL be replaced with `{ noProcessing: true }` (all previous keys SHALL be removed, not merged)
- **AND** all other rendered fields in every accordion group SHALL be in a disabled state

#### Scenario: Accordion expand/collapse works while disabled
- **WHEN** fields are disabled due to the "Sem Processamento" preset
- **THEN** the accordion sections SHALL still be expandable and collapsible
- **AND** field labels and descriptions SHALL still be readable
- **AND** only the interactive controls (switch, select, slider, input) SHALL be non-interactive

#### Scenario: Deselecting "Sem Processamento" re-enables fields
- **WHEN** the user switches from "Sem Processamento" to another preset or modifies a field manually
- **THEN** all fields SHALL be re-enabled
- **AND** the new preset's values SHALL populate `fieldOptions`

#### Scenario: "Sem Processamento" field itself remains toggleable
- **WHEN** the "Sem Processamento" preset is active
- **THEN** the `noProcessing` switch SHALL remain interactive
- **AND** toggling it off SHALL re-enable all other fields and set `activePresetId` to `null` (Personalizado)

#### Scenario: Exclusive preset from a different state clears previous overrides
- **WHEN** the user has `fieldOptions = { mangaMode: true, gamma: 2.0, jpegQuality: 75 }` and selects "Sem Processamento"
- **THEN** `fieldOptions` SHALL become `{ noProcessing: true }` ONLY
- **AND** `mangaMode`, `gamma`, and `jpegQuality` SHALL be removed from `fieldOptions`
