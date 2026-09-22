import { useState, useMemo } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { LANGUAGE_OPTIONS, SearchLanguage } from "./search-filter.types";

interface LanguageSelectorPopoverProps {
  value: SearchLanguage;
  onChange: (language: SearchLanguage) => void;
}

export function LanguageSelectorPopover({ value, onChange }: LanguageSelectorPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedOption = LANGUAGE_OPTIONS.find((l) => l.value === value) ?? LANGUAGE_OPTIONS[0];

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return LANGUAGE_OPTIONS;
    const q = search.toLowerCase().trim();
    return LANGUAGE_OPTIONS.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.shortLabel.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q),
    );
  }, [search]);

  const allOption = useMemo(
    () => filteredOptions.find((opt) => opt.value === "all"),
    [filteredOptions],
  );

  const regularOptions = useMemo(
    () => filteredOptions.filter((opt) => opt.value !== "all"),
    [filteredOptions],
  );

  const handleSelect = (lang: SearchLanguage) => {
    onChange(lang);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Idioma: ${selectedOption.label}`}
          title={`Filtrar por idioma (atual: ${selectedOption.label})`}
          className="flex h-full items-center gap-1.5 px-3 text-xs font-bold text-ink hover:bg-muted/70 active:bg-muted transition-colors cursor-pointer select-none rounded-r-[3px]"
        >
          <span className="font-mono text-xs font-bold tracking-tight text-ink">
            {selectedOption.shortLabel}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-ink/70 stroke-[2.5]" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-64 border-2 border-ink rounded-md bg-card shadow-comic-sm p-1.5 z-50 animate-comic-pop"
      >
        {/* Campo de busca limpo e compacto */}
        <div className="relative mb-1.5 px-0.5">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink/50 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar idioma..."
            aria-label="Buscar idioma"
            className="h-8 pl-8 pr-7 text-xs border border-ink/40 bg-background font-medium text-ink focus-visible:ring-0 focus-visible:border-ink shadow-none rounded"
          />
          {search.length > 0 && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Limpar filtro de idiomas"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink/60 hover:text-ink cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Lista de Idiomas */}
        <div className="max-h-[260px] overflow-y-auto space-y-0.5 pr-0.5">
          {/* Opção Todos os Idiomas */}
          {allOption && (
            <button
              type="button"
              onClick={() => handleSelect("all")}
              className={cn(
                "w-full flex items-center justify-between rounded px-2.5 py-1.5 text-xs transition-colors cursor-pointer select-none text-left",
                value === "all"
                  ? "bg-comic-yellow text-ink font-bold"
                  : "hover:bg-muted text-foreground font-medium",
              )}
            >
              <span>Todos os Idiomas</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground font-bold">TODOS</span>
                {value === "all" && <Check className="h-3.5 w-3.5 text-ink stroke-[3]" />}
              </div>
            </button>
          )}

          {allOption && regularOptions.length > 0 && (
            <div className="my-1 border-t border-ink/15" />
          )}

          {regularOptions.map((opt) => {
            const isSelected = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  "w-full flex items-center justify-between rounded px-2.5 py-1.5 text-xs transition-colors cursor-pointer select-none text-left",
                  isSelected
                    ? "bg-comic-yellow/30 text-ink font-bold"
                    : "hover:bg-muted text-foreground font-medium",
                )}
              >
                <span className="truncate">{opt.label}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono text-[10px] text-muted-foreground font-bold">
                    {opt.shortLabel}
                  </span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-ink stroke-[3]" />}
                </div>
              </button>
            );
          })}

          {filteredOptions.length === 0 && (
            <div className="py-4 text-center text-xs text-muted-foreground">
              Nenhum idioma encontrado
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
