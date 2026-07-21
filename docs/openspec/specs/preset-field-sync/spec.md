# preset-field-sync Specification

## Purpose
TBD - created by archiving change wizard-conversion-fields. Update Purpose after archive.
## Requirements
### Requirement: Presets Pre-fill Field Values

When a user selects a preset from the dropdown, the preset's values SHALL be applied to `fieldOptions`, updating all rendered fields accordingly.

`fieldOptions` SHALL store only user overrides (deltas from defaults). The renderer SHALL use `fieldOptions[id] ?? field.default` as the display value.

#### Scenario: Selecting "Manga" preset fills manga-related fields
- **WHEN** the user selects the "Manga" preset
- **THEN** `fieldOptions` SHALL be updated with `{ mangaMode: true, cropping: "marginsAndPageNumbers", stretchMode: "upscale" }`
- **AND** the mangaMode switch SHALL be toggled on
- **AND** the cropping select SHALL show "Margens e Numeros"
- **AND** the stretchMode select SHALL show "Upscale"

#### Scenario: Selecting "Webtoon" preset fills webtoon-related fields
- **WHEN** the user selects the "Webtoon" preset
- **THEN** `fieldOptions` SHALL be updated with `{ webtoonMode: true, cropping: "margins", stretchMode: "stretch" }`
- **AND** the corresponding UI controls SHALL reflect these values

#### Scenario: Selecting "HQ Ocidental" (comic) preset fills comic-related fields
- **WHEN** the user selects the "HQ Ocidental" preset
- **THEN** `fieldOptions` SHALL be updated with `{ cropping: "marginsAndPageNumbers" }`
- **AND** the cropping select SHALL show "Margens e Numeros"

#### Scenario: Selecting "Alta Qualidade" (highQuality) preset fills quality fields
- **WHEN** the user selects the "Alta Qualidade" preset
- **THEN** `fieldOptions` SHALL be updated with `{ highQuality: true, stretchMode: "upscale" }`
- **AND** the corresponding controls SHALL reflect these values

#### Scenario: Preset values that are already set are preserved
- **WHEN** a user selects a preset that only specifies a subset of fields
- **THEN** field values NOT specified by the preset SHALL retain their current values

#### Scenario: Preset selection does NOT cause false positives with extra fields
- **WHEN** a user has the "Manga" preset selected and manually adds `gamma: 2.0` (a field not in the preset)
- **THEN** the preset SHALL still be detected as "Manga" because all preset-specified keys match
- **AND** the `gamma` field SHALL retain its user-configured value of `2.0`

#### Scenario: Reset to defaults clears all overrides
- **WHEN** the user clicks "Restaurar padroes"
- **THEN** `fieldOptions` SHALL be reset to `{}` (empty object)
- **AND** the preset SHALL revert to the first preset in the list
- **AND** all rendered fields SHALL display their `field.default` values

---

### Requirement: Custom Preset Detection on Field Divergence

When the user modifies individual fields after selecting a preset, the system SHALL detect that the current effective state no longer matches any backend preset and SHALL switch the preset display to "Personalizado".

The detection SHALL use strict matching: the effective state (defaults + overrides) must contain every key from `preset.values` with identical values. Fields NOT specified by the preset MAY have any value without breaking the match.

#### Scenario: Modifying a field after preset selection shows "Personalizado"
- **WHEN** the user has "Manga" preset selected and changes `stretchMode` from "upscale" to "stretch"
- **THEN** the preset dropdown SHALL display "Personalizado"
- **AND** no synthetic "Personalizado" option SHALL be injected into the dropdown — it SHALL exist only as a display value when `value=""`

#### Scenario: Restoring preset values switches back to the preset
- **WHEN** the user has "Personalizado" active and changes `stretchMode` back to "upscale" (matching the Manga preset values)
- **THEN** the preset dropdown SHALL display "Manga" again

#### Scenario: Two consecutive preset changes preserve integrity
- **WHEN** the user selects "Manga", then selects "Webtoon", then selects "Manga" again
- **THEN** after each selection, `fieldOptions` SHALL contain exactly the correct merged values for that preset
- **AND** no residual values from the previous preset SHALL remain

#### Scenario: Rapid preset-field-preset-field sequence has no race conditions
- **WHEN** the user rapidly alternates between selecting a preset and modifying individual fields
- **THEN** the state SHALL remain consistent — `activePresetId` SHALL always reflect the correct match at any given moment

#### Scenario: Backend with zero presets still allows field configuration
- **WHEN** the backend returns `presets: []`
- **THEN** the preset dropdown SHALL be empty
- **AND** all individual conversion fields SHALL still be configurable
- **AND** `activePresetId` SHALL remain `null`

---

### Requirement: Field Options Sent on Conversion Creation

The `fieldOptions` state SHALL be correctly sent as `options` in the `POST /api/conversions` request body. Only user overrides SHALL be included — fields never modified by the user SHALL be omitted.

#### Scenario: Configured fields are sent as overrides
- **WHEN** the user has configured `jpegQuality: 75` and `forceColor: true` and clicks "Converter"
- **THEN** the request body SHALL include `options: { jpegQuality: 75, forceColor: true }`

#### Scenario: Preset-only configuration sends preset values
- **WHEN** the user has selected "Manga" preset and made no individual changes
- **THEN** the request body SHALL include `options: { mangaMode: true, cropping: "marginsAndPageNumbers", stretchMode: "upscale" }`

#### Scenario: Empty field options are sent as empty object
- **WHEN** the user has not modified any field and has no preset selected
- **THEN** the request body SHALL include `options: {}`

#### Scenario: Preset + extra overrides sends merged set
- **WHEN** the user has "Manga" preset and manually sets `gamma: 2.0`
- **THEN** the request body SHALL include `options: { mangaMode: true, cropping: "marginsAndPageNumbers", stretchMode: "upscale", gamma: 2.0 }`

