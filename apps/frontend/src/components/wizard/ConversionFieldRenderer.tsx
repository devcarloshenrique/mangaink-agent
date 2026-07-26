import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ConversionField } from "@/types/conversion";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RotateCcw, AlertTriangle } from "lucide-react";

interface ConversionFieldRendererProps {
  field: ConversionField;
  value: string | number | boolean;
  onChange: (id: string, value: string | number | boolean) => void;
  onReset?: (id: string) => void;
  disabled?: boolean;
  hasOverride?: boolean;
  conflictReason?: string;
}

const FieldInfoCtx = createContext<{ open: boolean; toggle: () => void } | null>(null);

/**
 * Descrições e textos de ajuda ficam ocultos atrás de um badge de info,
 * exibidos inline (sem portal) logo abaixo do campo.
 */
function FieldInfo({ field }: { field: ConversionField }) {
  const ctx = useContext(FieldInfoCtx);
  if (!field.description && !field.help) return null;
  return (
    <button
      type="button"
      aria-label={`O que faz "${field.label}"?`}
      aria-expanded={!!ctx?.open}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        ctx?.toggle();
      }}
      className={cn(
        "inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border-[2px] border-ink text-[11px] font-bold leading-none shrink-0 transition-colors",
        ctx?.open
          ? "bg-comic-ink text-comic-cream"
          : "bg-card text-muted-foreground hover:bg-comic-yellow hover:text-comic-ink",
      )}
    >
      ?
    </button>
  );

}

function FieldInfoNote({ field, open }: { field: ConversionField; open: boolean }) {
  if (!open || (!field.description && !field.help)) return null;
  return (
    <div className="mb-2 mt-1 rounded-md border-l-[3px] border-ink bg-muted px-2.5 py-2 space-y-1">
      {field.description && <p className="text-xs font-medium">{field.description}</p>}
      {field.help && (
        <p id={`${field.id}-help`} className="text-[11px] font-medium opacity-70 italic">
          {field.help}
        </p>
      )}
    </div>
  );
}

function ResetBtn({
  field,
  onReset,
  hasOverride,
}: Pick<ConversionFieldRendererProps, "field" | "onReset" | "hasOverride">) {
  if (!hasOverride || !onReset) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-5 w-5 p-0 hover:bg-muted"
      onClick={(e) => {
        e.preventDefault();
        onReset(field.id);
      }}
      title="Restaurar padrão"
    >
      <RotateCcw className="h-3 w-3 text-muted-foreground" />
    </Button>
  );
}

function BooleanField({
  field,
  value,
  onChange,
  onReset,
  disabled,
  hasOverride,
}: ConversionFieldRendererProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <Label
          htmlFor={field.id}
          className={cn(
            "font-display text-sm cursor-pointer",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {field.label}
        </Label>
        <FieldInfo field={field} />
        <ResetBtn field={field} onReset={onReset} hasOverride={hasOverride} />
      </div>
      <Switch
        id={field.id}
        checked={!!value}
        onCheckedChange={(v) => onChange(field.id, v)}
        disabled={disabled}
        aria-label={field.label}
        aria-describedby={field.help ? `${field.id}-help` : undefined}
        data-testid={`conversion-field-${field.id}`}
        className="shrink-0"
      />
    </div>
  );
}

function EnumField({
  field,
  value,
  onChange,
  onReset,
  disabled,
  hasOverride,
}: ConversionFieldRendererProps) {
  return (
    <div className="space-y-1.5 py-2">
      <div className="flex items-center gap-1.5">
        <Label
          htmlFor={field.id}
          className={cn("font-display text-sm", disabled && "cursor-not-allowed opacity-50")}
        >
          {field.label}
        </Label>
        <FieldInfo field={field} />
        <ResetBtn field={field} onReset={onReset} hasOverride={hasOverride} />
      </div>
      <Select
        value={String(value ?? "")}
        onValueChange={(v) => onChange(field.id, v)}
        disabled={disabled}
      >
        <SelectTrigger
          id={field.id}
          className="border-[2.5px] border-ink h-10 shadow-comic-sm"
          aria-label={field.label}
          aria-describedby={field.help ? `${field.id}-help` : undefined}
          data-testid={`conversion-field-${field.id}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-[2.5px] border-ink">
          {field.options?.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SliderField({
  field,
  value,
  onChange,
  onReset,
  disabled,
  hasOverride,
}: ConversionFieldRendererProps) {
  const hasAutoDefault = typeof field.default === "string" && field.default !== "";
  const isAuto = hasAutoDefault && typeof value === "string";

  const numericValue =
    typeof value === "number" && !isNaN(value)
      ? value
      : typeof field.default === "number"
        ? field.default
        : (field.min ?? 0);

  const displayValue = isAuto ? "Auto" : numericValue;

  return (
    <div className="space-y-2 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className={cn("font-display text-sm", disabled && "cursor-not-allowed opacity-50")}>
            {field.label}
          </span>
          <FieldInfo field={field} />
          <ResetBtn field={field} onReset={onReset} hasOverride={hasOverride} />
        </div>
        <span
          className={cn(
            "font-display text-xs bg-comic-yellow border-[2px] border-ink px-2 py-0.5 rounded shadow-comic-sm shrink-0",
            disabled && "opacity-50",
          )}
        >
          {displayValue}
        </span>
      </div>
      <Slider
        value={[numericValue]}
        min={field.min ?? 0}
        max={field.max ?? 5}
        step={field.step ?? 0.1}
        onValueChange={([v]) => onChange(field.id, v)}
        disabled={disabled}
        aria-label={field.label}
        aria-describedby={field.help ? `${field.id}-help` : undefined}
        data-testid={`conversion-field-${field.id}`}
      />
    </div>
  );
}

function NumberInputField({
  field,
  value,
  onChange,
  onReset,
  disabled,
  hasOverride,
}: ConversionFieldRendererProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState(() =>
    value !== undefined && value !== null ? String(value) : String(field.default ?? ""),
  );
  const prevValueRef = useRef(localValue);

  const commitValue = useCallback(
    (raw: string) => {
      const parsed = Number(raw);
      if (isNaN(parsed)) {
        setLocalValue(prevValueRef.current);
        return;
      }
      let clamped = parsed;
      if (field.min !== undefined && parsed < field.min) clamped = field.min;
      if (field.max !== undefined && parsed > field.max) clamped = field.max;
      setLocalValue(String(clamped));
      prevValueRef.current = String(clamped);
      onChange(field.id, clamped);
    },
    [field, onChange],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalValue(e.target.value);
      const parsed = Number(e.target.value);
      if (!isNaN(parsed)) {
        prevValueRef.current = e.target.value;
        onChange(field.id, parsed);
      }
    },
    [field, onChange],
  );

  const handleBlur = useCallback(() => {
    commitValue(localValue);
  }, [commitValue, localValue]);

  return (
    <div className="space-y-1.5 py-2">
      <div className="flex items-center gap-1.5">
        <Label
          htmlFor={field.id}
          className={cn("font-display text-sm", disabled && "cursor-not-allowed opacity-50")}
        >
          {field.label}
        </Label>
        <FieldInfo field={field} />
        <ResetBtn field={field} onReset={onReset} hasOverride={hasOverride} />
      </div>
      <Input
        ref={inputRef}
        id={field.id}
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        aria-label={field.label}
        aria-describedby={field.help ? `${field.id}-help` : undefined}
        data-testid={`conversion-field-${field.id}`}
        className="border-[2.5px] border-ink h-10 shadow-comic-sm w-full max-w-[160px]"
      />
    </div>
  );
}

function FallbackField({ field }: { field: ConversionField }) {
  return (
    <div className="border-[2px] border-dashed border-ink rounded-lg p-3 py-2 opacity-60">
      <p className="font-display text-xs text-muted-foreground">
        Tipo não suportado: {field.type}/{field.component}
      </p>
    </div>
  );
}

function ConflictReason({ reason }: { reason?: string }) {
  if (!reason) return null;
  return (
    <p className="flex items-center gap-1 text-[11px] font-medium text-comic-red mt-1">
      <AlertTriangle className="h-3 w-3" />
      Desabilitado por: {reason}
    </p>
  );
}

export const ConversionFieldRenderer = React.memo(
  function ConversionFieldRenderer(props: ConversionFieldRendererProps) {
    const { field, disabled, conflictReason } = props;
    const [infoOpen, setInfoOpen] = useState(false);

    const renderField = () => {
      switch (true) {
        case field.type === "boolean" && field.component === "switch":
          return <BooleanField {...props} />;
        case field.type === "enum" && field.component === "select":
          return <EnumField {...props} />;
        case field.type === "number" && field.component === "slider":
          return <SliderField {...props} />;
        case field.type === "number" && field.component === "input":
          return <NumberInputField {...props} />;
        default:
          return <FallbackField field={field} />;
      }
    };

    const isToggleRow = field.type === "boolean" && field.component === "switch";

    return (
      <div
        className={cn(
          "block w-full rounded-md transition-colors",
          isToggleRow && !disabled && "hover:!bg-comic-yellow/30",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        )}
      >
        <FieldInfoCtx.Provider value={{ open: infoOpen, toggle: () => setInfoOpen((v) => !v) }}>
          {renderField()}
        </FieldInfoCtx.Provider>
        <FieldInfoNote field={field} open={infoOpen} />
        <ConflictReason reason={disabled ? conflictReason : undefined} />
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.field.id === next.field.id &&
      prev.value === next.value &&
      prev.disabled === next.disabled &&
      prev.hasOverride === next.hasOverride &&
      prev.conflictReason === next.conflictReason
    );
  },
);
