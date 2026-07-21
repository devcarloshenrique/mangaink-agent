## ADDED Requirements

### Requirement: User Can Create Custom Presets

When the user has a custom configuration (no preset matches), they SHALL be able to save the current `fieldOptions` as a named preset for future reuse.

#### Scenario: Saving a custom configuration as a preset
- **WHEN** the user has `activePresetId === null` (custom configuration) and clicks "Salvar como preset"
- **THEN** a dialog SHALL open with fields for name (required) and description (optional)
- **AND** the dialog SHALL display a summary of the current `fieldOptions` values
- **AND** upon submitting a valid name, a `POST /api/conversions/presets` request SHALL be sent
- **AND** the new preset SHALL appear in the dropdown under "Meus presets"
- **AND** `activePresetId` SHALL update to the new preset's ID

#### Scenario: Duplicate name is rejected
- **WHEN** the user attempts to save a preset with a name already used by another of their presets
- **THEN** the dialog SHALL display an inline error message below the name field
- **AND** the save button SHALL remain disabled until the name is changed

#### Scenario: Preset limit is enforced
- **WHEN** the user has reached the configurable limit and attempts to create another
- **THEN** the "Salvar como preset" button SHALL be disabled
- **AND** a message SHALL indicate the limit has been reached

---

### Requirement: User Can Manage Custom Presets

Users SHALL be able to edit metadata and delete their custom presets.

#### Scenario: Editing a preset name and description
- **WHEN** the user clicks the edit icon on one of their presets in the dropdown
- **THEN** a dialog SHALL open pre-filled with the preset's current name and description
- **AND** upon saving, a `PATCH /api/conversions/presets/:id` request SHALL be sent
- **AND** the dropdown SHALL reflect the updated name

#### Scenario: Updating preset values
- **WHEN** the user has modified fields after selecting their user preset (activePresetSource === 'user')
- **AND** clicks "Atualizar [preset name]"
- **THEN** a `PUT /api/conversions/presets/:id/values` request SHALL be sent with the current `fieldOptions`
- **AND** the preset SHALL be updated with the new values
- **AND** `activePresetId` SHALL re-resolve to the updated preset

#### Scenario: Saving as new preset instead of updating
- **WHEN** the user has modified fields after selecting their user preset
- **AND** clicks "Salvar como novo"
- **THEN** the SavePresetDialog SHALL open in creation mode
- **AND** the user can save the configuration as a new, separate preset

#### Scenario: Deleting a preset that is currently selected
- **WHEN** the user deletes the preset that is currently active
- **THEN** a confirmation dialog SHALL appear before deletion
- **AND** upon confirming, a `DELETE /api/conversions/presets/:id` request SHALL be sent
- **AND** `fieldOptions` SHALL retain its current values (no reset)
- **AND** `activePresetId` SHALL become `null` ("Personalizado")

#### Scenario: Deleting a preset that is NOT currently selected
- **WHEN** the user deletes a preset that is not the active one
- **THEN** no field values SHALL be changed
- **AND** the preset SHALL be removed from the dropdown

#### Scenario: User cannot modify system presets
- **WHEN** a system preset is displayed in the dropdown
- **THEN** no edit, delete, or update actions SHALL be available for that preset

---

### Requirement: User Can Set a Default Preset

Each user SHALL be able to mark at most one preset as "default" for automatic pre-selection.

#### Scenario: Marking a preset as default
- **WHEN** the user clicks the star/favorite icon on one of their presets
- **THEN** a `PATCH /api/conversions/presets/:id` request SHALL be sent with `isDefault: true`
- **AND** any previously default preset SHALL have its `isDefault` set to `false`
- **AND** the star icon SHALL be filled/highlighted on the new default

#### Scenario: Default preset is pre-selected on wizard load
- **WHEN** the user opens wizard step 4 and has a preset with `isDefault: true`
- **THEN** `fieldOptions` SHALL be pre-populated with the default preset's values
- **AND** the preset dropdown SHALL show the default preset as selected

#### Scenario: No default preset falls back to empty state
- **WHEN** the user has no preset with `isDefault: true`
- **THEN** `fieldOptions` SHALL start as `{}` (empty — all fields show backend defaults)

---

### Requirement: Preset Dropdown Separates System and User Presets

The preset dropdown SHALL visually separate system presets from user presets.

#### Scenario: Dropdown sections are rendered
- **WHEN** the preset dropdown is opened
- **THEN** system presets SHALL appear under a "Presets do sistema" section header
- **AND** user presets SHALL appear under a "Meus presets" section header
- **AND** the sections SHALL be visually separated

#### Scenario: User presets show inline actions
- **WHEN** the "Meus presets" section is visible
- **THEN** each user preset SHALL have edit, delete, and favorite action icons
- **AND** clicking an action icon SHALL NOT trigger preset selection

#### Scenario: User with no custom presets
- **WHEN** the user has no custom presets
- **THEN** the "Meus presets" section SHALL show a subtle message: "Nenhum preset salvo"

---

### Requirement: Preset Detection Includes User Presets

The `activePresetId` detection SHALL check user presets before system presets.

#### Scenario: User preset takes priority over matching system preset
- **WHEN** a user preset and a system preset have identical values
- **AND** the current `fieldOptions` match those values
- **THEN** `activePresetId` SHALL resolve to the user preset's ID

#### Scenario: User presets are never exclusive
- **WHEN** a user preset is selected
- **THEN** all fields SHALL remain enabled (no disabled state)

---

### Requirement: Dedicated API Endpoint for User Presets

User presets SHALL be served from a dedicated endpoint, separate from the conversion options catalog.

#### Scenario: Catalog endpoint is unaffected
- **WHEN** `GET /api/conversions/options` is called
- **THEN** the response SHALL contain `presets` (system presets only)
- **AND** no user-specific preset data SHALL be included

#### Scenario: User presets endpoint requires authentication
- **WHEN** `GET /api/conversions/presets` is called without authentication
- **THEN** the server SHALL respond with 401 Unauthorized

#### Scenario: User presets endpoint returns only the authenticated user's presets
- **WHEN** `GET /api/conversions/presets` is called by an authenticated user
- **THEN** the response SHALL contain only presets belonging to that user
- **AND** presets from other users SHALL NOT be included
