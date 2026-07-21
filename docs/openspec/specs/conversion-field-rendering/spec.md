# conversion-field-rendering Specification

## Purpose
TBD - created by archiving change wizard-conversion-fields. Update Purpose after archive.
## Requirements
### Requirement: Render Conversion Fields by Type and Component

The frontend SHALL render every `ConversionField` from the backend catalog using the appropriate UI component based on `field.type` and `field.component`. Fields with unrecognized types SHALL render a fallback without breaking the page.

#### Scenario: Boolean field renders as switch
- **WHEN** a field has `type: "boolean"` and `component: "switch"`
- **THEN** the UI SHALL render a `<Switch>` component with the field's `label` as text label
- **AND** the switch SHALL reflect the current value from `fieldOptions` or the field's `default`
- **AND** toggling the switch SHALL call `onChange(field.id, newValue)`

#### Scenario: Enum field renders as select dropdown
- **WHEN** a field has `type: "enum"` and `component: "select"`
- **THEN** the UI SHALL render a `<Select>` component with `<SelectItem>` for each entry in `field.options`
- **AND** the selected value SHALL reflect the current value from `fieldOptions` or the field's `default`
- **AND** changing the selection SHALL call `onChange(field.id, newValue)`

#### Scenario: Number field renders as slider
- **WHEN** a field has `type: "number"` and `component: "slider"`
- **THEN** the UI SHALL render a `<Slider>` component with range constrained by `field.min` and `field.max`
- **AND** the slider step SHALL match `field.step`
- **AND** the current numeric value SHALL be displayed adjacent to the slider
- **AND** dragging the slider SHALL call `onChange(field.id, newValue)`

#### Scenario: Number field renders as input
- **WHEN** a field has `type: "number"` and `component: "input"`
- **THEN** the UI SHALL render an `<Input type="number">` with constraints from `field.min`, `field.max`, and `field.step`
- **AND** changing the input value SHALL call `onChange(field.id, newValue)`

#### Scenario: Numeric input rejects NaN
- **WHEN** the user types a non-numeric string into a number input
- **THEN** the value SHALL revert to the previous valid value (or `field.default` if no previous value)
- **AND** `onChange` SHALL NOT be called with NaN

#### Scenario: Numeric input clamps to range on blur
- **WHEN** the user types a value below `field.min` or above `field.max` into a number input and blurs
- **THEN** the value SHALL be clamped to the nearest boundary (`field.min` or `field.max`)
- **AND** `onChange` SHALL be called with the clamped value

#### Scenario: Unknown field type renders fallback
- **WHEN** a field has an unrecognized `type` or `component` combination (e.g., `type: "color"`)
- **THEN** the UI SHALL render a fallback card with dashed border containing the text "Tipo nao suportado: {type}/{component}"
- **AND** the page SHALL NOT crash or break

#### Scenario: Field without a default value renders gracefully
- **WHEN** a field has no `default` property defined
- **THEN** a switch SHALL render as off (false)
- **AND** a select SHALL render with no selection (placeholder visible)
- **AND** a slider SHALL render at `field.min` position
- **AND** an input SHALL render empty

#### Scenario: Field description and help text are displayed
- **WHEN** a field is rendered
- **THEN** the field's `description` SHALL be displayed below the label
- **AND** the field's `help` text SHALL be displayed as supplementary information (smaller, muted, italic)

---

### Requirement: Organize Fields in Group Accordions

The conversion field groups SHALL be rendered as collapsible accordion sections in the wizard step 4.

#### Scenario: Five group accordions are rendered
- **WHEN** the conversion options are loaded
- **THEN** the UI SHALL render 5 accordion sections: Leitura (reading), Processamento (processing), Imagem (image), Saida (output), and Formato (format)
- **AND** each section SHALL display its group label and field count

#### Scenario: Reading and processing groups are expanded by default
- **WHEN** the wizard step 4 first loads
- **THEN** the "Leitura" and "Processamento" accordion sections SHALL be expanded
- **AND** the "Imagem", "Saida", and "Formato" sections SHALL be collapsed

#### Scenario: Collapsing and expanding preserves field values
- **WHEN** a user collapses and then re-expands an accordion group
- **THEN** all field values within that group SHALL be preserved

#### Scenario: Disabled state prevents field interaction
- **WHEN** a field or group has `disabled={true}`
- **THEN** all interactive controls within that group SHALL be disabled
- **AND** the disabled controls SHALL have reduced opacity and `cursor-not-allowed`
- **AND** accordion expand/collapse SHALL still function when disabled

#### Scenario: Image group renders with subcategories
- **WHEN** the "Imagem" accordion group is expanded
- **THEN** its 15 fields SHALL be organized into 3 subcategories: "Cor e Contraste", "Qualidade e Formato", "Bordas e Recorte"
- **AND** each subcategory SHALL have a visual separator (`<Separator>`) and bold label
- **AND** fields within each subcategory SHALL be ordered as defined by `IMAGE_SUBCATEGORIES`

#### Scenario: New group from backend renders with fallback
- **WHEN** the backend introduces a new `field.group` value not in the known set (e.g., `"advanced"`)
- **THEN** a new accordion section SHALL be created with the groupId as label
- **AND** a generic fallback icon SHALL be used
- **AND** the section SHALL be collapsed by default

---

### Requirement: Accessibility

All conversion field controls SHALL be keyboard-navigable and screen-reader friendly.

#### Scenario: Labels are associated with controls
- **WHEN** a field is rendered
- **THEN** its interactive control SHALL have `aria-label` set to `field.label`
- **AND** its help text element SHALL have an `id` referenced by `aria-describedby` on the control

#### Scenario: Keyboard navigation works in accordion
- **WHEN** the user presses Arrow Up/Down within the accordion
- **THEN** focus SHALL move between accordion trigger items
- **AND** pressing Enter or Space on a collapsed trigger SHALL expand it
- **AND** pressing Enter or Space on an expanded trigger SHALL collapse it

#### Scenario: Focus moves to first field on group expand
- **WHEN** a collapsed accordion group is expanded via keyboard or mouse
- **THEN** focus SHALL move to the first interactive field within the expanded content

#### Scenario: Tab navigation works across fields
- **WHEN** the user presses Tab within an expanded accordion group
- **THEN** focus SHALL move sequentially through all interactive controls in DOM order
- **AND** disabled controls SHALL be skipped

