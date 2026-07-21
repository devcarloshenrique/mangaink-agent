import React, { useRef } from "react";
import type { ConversionField, FieldGroupId } from "@/types/conversion";
import { IMAGE_SUBCATEGORIES, FIELD_GROUP_LABELS } from "@/types/conversion";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ConversionFieldRenderer } from "@/components/wizard/ConversionFieldRenderer";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Cog,
  Image,
  FileOutput,
  FileType,
  Box,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

const GROUP_ICONS: Record<string, LucideIcon> = {
  reading: BookOpen,
  processing: Cog,
  image: Image,
  output: FileOutput,
  format: FileType,
};

interface ConversionFieldGroupProps {
  groupId: FieldGroupId | string;
  fields: ConversionField[];
  values: Record<string, string | number | boolean>;
  onChange: (id: string, value: string | number | boolean) => void;
  onReset?: (id: string) => void;
  onResetGroup?: () => void;
  disabled?: boolean;
  disabledFieldIds?: Set<string>;
  conflictReasons?: Map<string, string>;
  overrideCount?: number;
  hasOverrides?: boolean;
}

function getGroupLabel(groupId: string): string {
  if (groupId in FIELD_GROUP_LABELS) {
    return FIELD_GROUP_LABELS[groupId as FieldGroupId];
  }
  return groupId;
}

function getGroupIcon(groupId: string): LucideIcon {
  return GROUP_ICONS[groupId] ?? Box;
}

interface RenderSubcategoriesProps {
  fields: ConversionField[];
  values: Record<string, string | number | boolean>;
  onChange: (id: string, value: string | number | boolean) => void;
  onReset?: (id: string) => void;
  disabled?: boolean;
  disabledFieldIds?: Set<string>;
  conflictReasons?: Map<string, string>;
}

function RenderSubcategories({
  fields,
  values,
  onChange,
  onReset,
  disabled,
  disabledFieldIds,
  conflictReasons,
}: RenderSubcategoriesProps) {
  const fieldMap = new Map(fields.map((f) => [f.id, f]));
  const renderedIds = new Set<string>();

  return (
    <>
      {IMAGE_SUBCATEGORIES.map((sub, idx) => {
        const subFields = sub.fieldIds
          .map((id) => fieldMap.get(id))
          .filter((f): f is ConversionField => !!f);
        subFields.forEach((f) => renderedIds.add(f.id));

        return (
          <div key={sub.label}>
            {idx > 0 && <Separator className="my-3 border-[2px] border-dashed border-ink/30" />}
            <p className="font-display text-xs font-bold text-muted-foreground mb-2">{sub.label}</p>
            <div className="space-y-1.5">
              {subFields.map((f) => (
                <ConversionFieldRenderer
                  key={f.id}
                  field={f}
                  value={values[f.id] ?? f.default}
                  onChange={onChange}
                  onReset={onReset}
                  disabled={disabled || disabledFieldIds?.has(f.id)}
                  hasOverride={f.id in values}
                  conflictReason={conflictReasons?.get(f.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
      {fields
        .filter((f) => !renderedIds.has(f.id))
        .map((f) => (
          <ConversionFieldRenderer
            key={f.id}
            field={f}
            value={values[f.id] ?? f.default}
            onChange={onChange}
            onReset={onReset}
            disabled={disabled || disabledFieldIds?.has(f.id)}
            hasOverride={f.id in values}
            conflictReason={conflictReasons?.get(f.id)}
          />
        ))}
    </>
  );
}

export const ConversionFieldGroup = React.memo(function ConversionFieldGroup({
  groupId,
  fields,
  values,
  onChange,
  onReset,
  onResetGroup,
  disabled,
  disabledFieldIds,
  conflictReasons,
  overrideCount,
  hasOverrides,
}: ConversionFieldGroupProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const label = getGroupLabel(groupId);
  const Icon = getGroupIcon(groupId);
  const isImageGroup = groupId === "image";

  const handleToggle = (open: boolean | undefined) => {
    if (open && contentRef.current) {
      setTimeout(() => {
        contentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        const first = contentRef.current?.querySelector<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        first?.focus();
      }, 200);
    }
  };

  return (
    <AccordionItem
      value={groupId}
      className="border-[3px] border-ink rounded-lg mb-3 shadow-comic-sm overflow-hidden"
      data-testid={`conversion-group-${groupId}`}
      onToggle={handleToggle}
    >
      <AccordionTrigger
        className={cn(
          "font-display text-base px-4 py-3 hover:no-underline",
          "data-[state=open]:bg-secondary/30",
        )}
      >
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {label}
          <span
            className={cn(
              "font-sans text-[11px] font-bold bg-comic-blue text-accent-foreground border-[2px] border-ink px-2 py-0.5 rounded-full ml-1",
              disabled && "opacity-50",
            )}
          >
            {fields.length} opções
          </span>
          {overrideCount ? (
            <span
              className={cn(
                "animate-comic-pop font-sans text-[11px] font-bold bg-comic-yellow text-comic-ink border-[2px] border-ink px-2 py-0.5 rounded-full",
                disabled && "opacity-50",
              )}
            >
              {overrideCount} alterada{overrideCount > 1 ? "s" : ""}
            </span>
          ) : null}
        </span>
        {hasOverrides && onResetGroup && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 font-display text-xs ml-auto mr-2 hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              onResetGroup();
            }}
            title={`Restaurar padrões de ${label}`}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Restaurar
          </Button>
        )}
      </AccordionTrigger>
      <AccordionContent>
        <div ref={contentRef} className="px-4 pb-3">
          {isImageGroup ? (
            <RenderSubcategories
              fields={fields}
              values={values}
              onChange={onChange}
              onReset={onReset}
              disabled={disabled}
              disabledFieldIds={disabledFieldIds}
              conflictReasons={conflictReasons}
            />
          ) : (
            <div className="space-y-1.5">
              {fields.map((f) => (
                <ConversionFieldRenderer
                  key={f.id}
                  field={f}
                  value={values[f.id] ?? f.default}
                  onChange={onChange}
                  onReset={onReset}
                  disabled={disabled || disabledFieldIds?.has(f.id)}
                  hasOverride={f.id in values}
                  conflictReason={conflictReasons?.get(f.id)}
                />
              ))}
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
});
