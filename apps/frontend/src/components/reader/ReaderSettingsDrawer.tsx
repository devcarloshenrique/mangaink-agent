import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Minus, Plus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hideOverlay?: boolean;
  readingMode: string;
  onReadingModeChange: (mode: string) => void;
  zoomEnabled: boolean;
  onZoomEnabledChange: (enabled: boolean) => void;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  showScrollbar: boolean;
  onShowScrollbarChange: (show: boolean) => void;
  showProgress: boolean;
  onShowProgressChange: (show: boolean) => void;
  progressPosition: "top" | "bottom";
  onProgressPositionChange: (pos: "top" | "bottom") => void;
  progressStyle: "segmented" | "circular";
  onProgressStyleChange: (style: "segmented" | "circular") => void;
  filterSepia: boolean;
  onFilterSepiaChange: (v: boolean) => void;
  filterBW: boolean;
  onFilterBWChange: (v: boolean) => void;
  brightness: number;
  onBrightnessChange: (v: number) => void;
  contrast: number;
  onContrastChange: (v: number) => void;
  saturation: number;
  onSaturationChange: (v: number) => void;
  containToWidth: boolean;
  onContainToWidthChange: (v: boolean) => void;
  containToHeight: boolean;
  onContainToHeightChange: (v: boolean) => void;
  stretchSmallPages: boolean;
  onStretchSmallPagesChange: (v: boolean) => void;
  limitMaxWidth: boolean;
  onLimitMaxWidthChange: (v: boolean) => void;
  maxWidthPixels: number;
  onMaxWidthPixelsChange: (v: number) => void;
  limitMaxHeight: boolean;
  onLimitMaxHeightChange: (v: boolean) => void;
  maxHeightPixels: number;
  onMaxHeightPixelsChange: (v: number) => void;
  onResetFilters?: () => void;
}

// Controles com paleta do leitor (acento herda o tema escolhido pelo usuário)
const readerSwitch =
  "border-reader-border data-[state=checked]:bg-reader-accent data-[state=unchecked]:bg-reader-surface focus-visible:ring-reader-accent focus-visible:ring-offset-reader-bg [&>span]:border-reader-border [&>span[data-state=checked]]:bg-reader-bg [&>span[data-state=unchecked]]:bg-reader-muted";

const readerRadio =
  "h-4 w-4 border-[2px] border-reader-border bg-reader-surface shadow-none focus-visible:ring-reader-accent data-[state=checked]:border-reader-accent data-[state=checked]:bg-reader-accent [&_span>span]:h-2 [&_span>span]:w-2 [&_span>span]:bg-reader-bg";

const readerCheckbox =
  "h-4 w-4 rounded-[3px] border-[2px] border-reader-border bg-reader-surface shadow-none focus-visible:ring-reader-accent data-[state=checked]:border-reader-accent data-[state=checked]:bg-reader-accent data-[state=checked]:text-reader-bg";

const readerSlider =
  "[&>span:first-child]:bg-reader-border [&>span:first-child>span]:bg-reader-accent [&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5 [&_[role=slider]]:border-reader-accent [&_[role=slider]]:bg-reader-accent [&_[role=slider]]:shadow-none [&_[role=slider]]:focus-visible:ring-reader-accent";

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="text-[11px] font-medium text-reader-muted uppercase tracking-[0.18em] mb-3">
      {children}
    </h3>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <Label className="text-sm text-reader-foreground/80 cursor-pointer">{label}</Label>
      {children}
    </div>
  );
}

export function ReaderSettingsDrawer({
  open,
  onOpenChange,
  hideOverlay,
  readingMode,
  onReadingModeChange,
  zoomEnabled,
  onZoomEnabledChange,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  showScrollbar,
  onShowScrollbarChange,
  showProgress,
  onShowProgressChange,
  progressPosition,
  onProgressPositionChange,
  progressStyle,
  onProgressStyleChange,
  filterSepia,
  onFilterSepiaChange,
  filterBW,
  onFilterBWChange,
  brightness,
  onBrightnessChange,
  contrast,
  onContrastChange,
  saturation,
  onSaturationChange,
  containToWidth,
  onContainToWidthChange,
  containToHeight,
  onContainToHeightChange,
  stretchSmallPages,
  onStretchSmallPagesChange,
  limitMaxWidth,
  onLimitMaxWidthChange,
  maxWidthPixels,
  onMaxWidthPixelsChange,
  limitMaxHeight,
  onLimitMaxHeightChange,
  maxHeightPixels,
  onMaxHeightPixelsChange,
  onResetFilters,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-80 border-l border-reader-border bg-reader-bg text-reader-foreground p-0"
        hideOverlay={hideOverlay}
      >
        <SheetHeader className="px-5 py-4 border-b border-reader-border">
          <SheetTitle className="text-sm font-medium uppercase tracking-[0.18em] text-reader-muted">
            Configurações
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-65px)]">
          <div className="px-5 py-4 space-y-0">
            {/* Modo de Leitura */}
            <section className="pb-4">
              <SectionTitle>Modo de Leitura</SectionTitle>
              <RadioGroup
                value={readingMode}
                onValueChange={onReadingModeChange}
                className="space-y-1"
              >
                <div className="flex items-center gap-2 py-1.5">
                  <RadioGroupItem className={readerRadio} value="horizontal" id="mode-h" />
                  <Label
                    htmlFor="mode-h"
                    className="text-sm text-reader-foreground/80 cursor-pointer"
                  >
                    Horizontal
                  </Label>
                </div>
                <div className="flex items-center gap-2 py-1.5 opacity-40">
                  <RadioGroupItem className={readerRadio} value="vertical" id="mode-v" disabled />
                  <Label
                    htmlFor="mode-v"
                    className="text-sm text-reader-muted/70 cursor-not-allowed"
                  >
                    Vertical
                  </Label>
                </div>
                <div className="flex items-center gap-2 py-1.5 opacity-40">
                  <RadioGroupItem className={readerRadio} value="scroll" id="mode-s" disabled />
                  <Label
                    htmlFor="mode-s"
                    className="text-sm text-reader-muted/70 cursor-not-allowed"
                  >
                    Scroll infinito
                  </Label>
                </div>
              </RadioGroup>
              <div className="mt-4">
                <SettingRow label="Mostrar barra de rolagem">
                  <Switch
                    className={readerSwitch}
                    checked={showScrollbar}
                    onCheckedChange={onShowScrollbarChange}
                  />
                </SettingRow>
              </div>
            </section>

            <Separator className="bg-reader-border" />

            {/* Controles de Zoom */}
            <section className="py-4">
              <SectionTitle>Controles de Zoom</SectionTitle>
              <SettingRow label="Duplo clique para zoom">
                <Switch
                  className={readerSwitch}
                  checked={zoomEnabled}
                  onCheckedChange={onZoomEnabledChange}
                />
              </SettingRow>
              <div className="mt-3">
                <p className="text-xs text-reader-muted/80 mb-2">Nível de zoom</p>
                <div className="flex items-center justify-between gap-2 rounded-md border border-reader-border bg-reader-surface/60 p-1">
                  <button
                    type="button"
                    className="h-7 w-7 grid place-items-center rounded-[4px] text-reader-muted hover:text-reader-foreground hover:bg-reader-surface disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    onClick={onZoomOut}
                    disabled={zoomLevel <= 1}
                    aria-label="Diminuir zoom"
                  >
                    <Minus className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <span className="text-sm text-reader-accent min-w-[4rem] text-center font-mono tabular-nums">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    className="h-7 w-7 grid place-items-center rounded-[4px] text-reader-muted hover:text-reader-foreground hover:bg-reader-surface disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    onClick={onZoomIn}
                    disabled={zoomLevel >= 3}
                    aria-label="Aumentar zoom"
                  >
                    <Plus className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            </section>

            <Separator className="bg-reader-border" />

            {/* Barra de Progresso */}
            <section className="py-4">
              <SectionTitle>Barra de Progresso</SectionTitle>
              <SettingRow label="Mostrar barra">
                <Switch
                  className={readerSwitch}
                  checked={showProgress}
                  onCheckedChange={onShowProgressChange}
                />
              </SettingRow>
              <div className="mt-2">
                <p className="text-xs text-reader-muted/80 mb-2">Posição</p>
                <RadioGroup
                  value={progressPosition}
                  onValueChange={(v) => onProgressPositionChange(v as "top" | "bottom")}
                  className="flex gap-4"
                >
                  <div
                    className={`flex items-center gap-1.5 ${
                      progressStyle === "circular" ? "opacity-40" : ""
                    }`}
                  >
                    <RadioGroupItem
                      className={readerRadio}
                      value="top"
                      id="pos-top"
                      disabled={progressStyle === "circular"}
                    />
                    <Label
                      htmlFor="pos-top"
                      className={`text-xs text-reader-muted ${
                        progressStyle === "circular" ? "cursor-not-allowed" : "cursor-pointer"
                      }`}
                    >
                      Superior
                    </Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem className={readerRadio} value="bottom" id="pos-bottom" />
                    <Label
                      htmlFor="pos-bottom"
                      className="text-xs text-reader-muted cursor-pointer"
                    >
                      Inferior
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="mt-3">
                <p className="text-xs text-reader-muted/80 mb-2">Estilo</p>
                <RadioGroup
                  value={progressStyle}
                  onValueChange={(v) => onProgressStyleChange(v as "segmented" | "circular")}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem className={readerRadio} value="segmented" id="style-seg" />
                    <Label htmlFor="style-seg" className="text-xs text-reader-muted cursor-pointer">
                      Segmentada
                    </Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem className={readerRadio} value="circular" id="style-circ" />
                    <Label
                      htmlFor="style-circ"
                      className="text-xs text-reader-muted cursor-pointer"
                    >
                      Circular
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </section>

            <Separator className="bg-reader-border" />

            {/* Recursos de Imagem */}
            <section className="py-4">
              <SectionTitle>Recursos de Imagem</SectionTitle>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    className={readerCheckbox}
                    id="contain-width"
                    checked={containToWidth}
                    onCheckedChange={(c) => onContainToWidthChange(c === true)}
                  />
                  <label
                    htmlFor="contain-width"
                    className="text-sm text-reader-foreground/80 cursor-pointer"
                  >
                    Conter na largura
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    className={readerCheckbox}
                    id="contain-height"
                    checked={containToHeight}
                    onCheckedChange={(c) => onContainToHeightChange(c === true)}
                  />
                  <label
                    htmlFor="contain-height"
                    className="text-sm text-reader-foreground/80 cursor-pointer"
                  >
                    Conter na altura
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    className={readerCheckbox}
                    id="stretch-small"
                    checked={stretchSmallPages}
                    onCheckedChange={(c) => onStretchSmallPagesChange(c === true)}
                  />
                  <label
                    htmlFor="stretch-small"
                    className="text-sm text-reader-foreground/80 cursor-pointer"
                  >
                    Esticar páginas pequenas
                  </label>
                </div>

                <Separator className="bg-reader-border my-4" />

                <div className="flex items-center space-x-3">
                  <Checkbox
                    className={readerCheckbox}
                    id="limit-max-width"
                    checked={limitMaxWidth}
                    onCheckedChange={(c) => onLimitMaxWidthChange(c === true)}
                  />
                  <label
                    htmlFor="limit-max-width"
                    className="text-sm text-reader-foreground/80 cursor-pointer"
                  >
                    Limitar largura máxima
                  </label>
                </div>
                {limitMaxWidth && (
                  <div className="pl-7 pt-1 pb-2">
                    <p className="text-xs text-reader-muted/80 mb-2">
                      Largura máxima ({maxWidthPixels}px)
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-reader-border text-reader-muted hover:text-reader-foreground hover:border-reader-muted shrink-0"
                        onClick={() => onMaxWidthPixelsChange(Math.max(200, maxWidthPixels - 100))}
                        disabled={maxWidthPixels <= 200}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Slider
                        value={[maxWidthPixels]}
                        onValueChange={([v]) => onMaxWidthPixelsChange(v)}
                        min={200}
                        max={4000}
                        step={100}
                        className={`flex-1 ${readerSlider}`}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-reader-border text-reader-muted hover:text-reader-foreground hover:border-reader-muted shrink-0"
                        onClick={() => onMaxWidthPixelsChange(Math.min(4000, maxWidthPixels + 100))}
                        disabled={maxWidthPixels >= 4000}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-3">
                  <Checkbox
                    className={readerCheckbox}
                    id="limit-max-height"
                    checked={limitMaxHeight}
                    onCheckedChange={(c) => onLimitMaxHeightChange(c === true)}
                  />
                  <label
                    htmlFor="limit-max-height"
                    className="text-sm text-reader-foreground/80 cursor-pointer"
                  >
                    Limitar altura máxima
                  </label>
                </div>
                {limitMaxHeight && (
                  <div className="pl-7 pt-1 pb-2">
                    <p className="text-xs text-reader-muted/80 mb-2">
                      Altura máxima ({maxHeightPixels}px)
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-reader-border text-reader-muted hover:text-reader-foreground hover:border-reader-muted shrink-0"
                        onClick={() =>
                          onMaxHeightPixelsChange(Math.max(200, maxHeightPixels - 100))
                        }
                        disabled={maxHeightPixels <= 200}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Slider
                        value={[maxHeightPixels]}
                        onValueChange={([v]) => onMaxHeightPixelsChange(v)}
                        min={200}
                        max={4000}
                        step={100}
                        className={`flex-1 ${readerSlider}`}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-reader-border text-reader-muted hover:text-reader-foreground hover:border-reader-muted shrink-0"
                        onClick={() =>
                          onMaxHeightPixelsChange(Math.min(4000, maxHeightPixels + 100))
                        }
                        disabled={maxHeightPixels >= 4000}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <Separator className="bg-reader-border" />

            {/* Filtros e Ajustes Visuais */}
            <section className="py-4">
              <div className="flex items-center justify-between mb-3">
                <SectionTitle>Filtros e Ajustes</SectionTitle>
                {onResetFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onResetFilters}
                    className="text-xs text-reader-muted/80 hover:text-reader-foreground/80 h-auto py-1 px-2"
                  >
                    Restaurar padrões
                  </Button>
                )}
              </div>

              <SettingRow label="Sépia">
                <Switch
                  className={readerSwitch}
                  checked={filterSepia}
                  onCheckedChange={onFilterSepiaChange}
                />
              </SettingRow>
              <SettingRow label="Preto e Branco">
                <Switch
                  className={readerSwitch}
                  checked={filterBW}
                  onCheckedChange={onFilterBWChange}
                />
              </SettingRow>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs text-reader-muted/80 mb-1">Brilho ({brightness}%)</p>
                  <Slider
                    value={[brightness]}
                    onValueChange={([v]) => onBrightnessChange(v)}
                    min={0}
                    max={200}
                    step={1}
                    className={readerSlider}
                  />
                </div>
                <div>
                  <p className="text-xs text-reader-muted/80 mb-1">Contraste ({contrast}%)</p>
                  <Slider
                    value={[contrast]}
                    onValueChange={([v]) => onContrastChange(v)}
                    min={0}
                    max={200}
                    step={1}
                    className={readerSlider}
                  />
                </div>
                <div>
                  <p className="text-xs text-reader-muted/80 mb-1">Saturação ({saturation}%)</p>
                  <Slider
                    value={[saturation]}
                    onValueChange={([v]) => onSaturationChange(v)}
                    min={0}
                    max={200}
                    step={1}
                    className={readerSlider}
                  />
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
