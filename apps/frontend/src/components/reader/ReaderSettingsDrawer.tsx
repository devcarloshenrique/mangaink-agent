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

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="font-display text-sm text-white/60 uppercase tracking-wider mb-3">{children}</h3>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <Label className="text-sm text-white/70 cursor-pointer">{label}</Label>
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
        className="w-80 border-l-2 border-ink bg-black/95 text-white p-0"
        hideOverlay={hideOverlay}
      >
        <SheetHeader className="px-5 py-4 border-b border-white/10">
          <SheetTitle className="font-display text-lg text-white/90">Configurações</SheetTitle>
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
                  <RadioGroupItem value="horizontal" id="mode-h" />
                  <Label htmlFor="mode-h" className="text-sm text-white/70 cursor-pointer">
                    Horizontal
                  </Label>
                </div>
                <div className="flex items-center gap-2 py-1.5 opacity-40">
                  <RadioGroupItem value="vertical" id="mode-v" disabled />
                  <Label htmlFor="mode-v" className="text-sm text-white/50 cursor-not-allowed">
                    Vertical
                  </Label>
                </div>
                <div className="flex items-center gap-2 py-1.5 opacity-40">
                  <RadioGroupItem value="scroll" id="mode-s" disabled />
                  <Label htmlFor="mode-s" className="text-sm text-white/50 cursor-not-allowed">
                    Scroll infinito
                  </Label>
                </div>
              </RadioGroup>
              <div className="mt-4">
                <SettingRow label="Mostrar barra de rolagem">
                  <Switch checked={showScrollbar} onCheckedChange={onShowScrollbarChange} />
                </SettingRow>
              </div>
            </section>

            <Separator className="bg-white/10" />

            {/* Controles de Zoom */}
            <section className="py-4">
              <SectionTitle>Controles de Zoom</SectionTitle>
              <SettingRow label="Duplo clique para zoom">
                <Switch checked={zoomEnabled} onCheckedChange={onZoomEnabledChange} />
              </SettingRow>
              <div className="mt-3">
                <p className="text-xs text-white/40 mb-2">Nível de zoom</p>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 border-white/20 text-white/60 hover:text-white hover:border-white/40"
                    onClick={onZoomOut}
                    disabled={zoomLevel <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-white/70 min-w-[4rem] text-center font-mono tabular-nums">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 border-white/20 text-white/60 hover:text-white hover:border-white/40"
                    onClick={onZoomIn}
                    disabled={zoomLevel >= 3}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </section>

            <Separator className="bg-white/10" />

            {/* Barra de Progresso */}
            <section className="py-4">
              <SectionTitle>Barra de Progresso</SectionTitle>
              <SettingRow label="Mostrar barra">
                <Switch checked={showProgress} onCheckedChange={onShowProgressChange} />
              </SettingRow>
              <div className="mt-2">
                <p className="text-xs text-white/40 mb-2">Posição</p>
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
                      value="top"
                      id="pos-top"
                      disabled={progressStyle === "circular"}
                    />
                    <Label
                      htmlFor="pos-top"
                      className={`text-xs text-white/60 ${
                        progressStyle === "circular" ? "cursor-not-allowed" : "cursor-pointer"
                      }`}
                    >
                      Superior
                    </Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="bottom" id="pos-bottom" />
                    <Label htmlFor="pos-bottom" className="text-xs text-white/60 cursor-pointer">
                      Inferior
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="mt-3">
                <p className="text-xs text-white/40 mb-2">Estilo</p>
                <RadioGroup
                  value={progressStyle}
                  onValueChange={(v) => onProgressStyleChange(v as "segmented" | "circular")}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="segmented" id="style-seg" />
                    <Label htmlFor="style-seg" className="text-xs text-white/60 cursor-pointer">
                      Segmentada
                    </Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="circular" id="style-circ" />
                    <Label htmlFor="style-circ" className="text-xs text-white/60 cursor-pointer">
                      Circular
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </section>

            <Separator className="bg-white/10" />

            {/* Recursos de Imagem */}
            <section className="py-4">
              <SectionTitle>Recursos de Imagem</SectionTitle>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Checkbox 
                    id="contain-width" 
                    checked={containToWidth} 
                    onCheckedChange={(c) => onContainToWidthChange(c === true)} 
                  />
                  <label htmlFor="contain-width" className="text-sm text-white/70 cursor-pointer">
                    Conter na largura
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox 
                    id="contain-height" 
                    checked={containToHeight} 
                    onCheckedChange={(c) => onContainToHeightChange(c === true)} 
                  />
                  <label htmlFor="contain-height" className="text-sm text-white/70 cursor-pointer">
                    Conter na altura
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox 
                    id="stretch-small" 
                    checked={stretchSmallPages} 
                    onCheckedChange={(c) => onStretchSmallPagesChange(c === true)} 
                  />
                  <label htmlFor="stretch-small" className="text-sm text-white/70 cursor-pointer">
                    Esticar páginas pequenas
                  </label>
                </div>

                <Separator className="bg-white/10 my-4" />

                <div className="flex items-center space-x-3">
                  <Checkbox 
                    id="limit-max-width" 
                    checked={limitMaxWidth} 
                    onCheckedChange={(c) => onLimitMaxWidthChange(c === true)} 
                  />
                  <label htmlFor="limit-max-width" className="text-sm text-white/70 cursor-pointer">
                    Limitar largura máxima
                  </label>
                </div>
                {limitMaxWidth && (
                  <div className="pl-7 pt-1 pb-2">
                    <p className="text-xs text-white/40 mb-2">Largura máxima ({maxWidthPixels}px)</p>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-white/20 text-white/60 hover:text-white hover:border-white/40 shrink-0"
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
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-white/20 text-white/60 hover:text-white hover:border-white/40 shrink-0"
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
                    id="limit-max-height" 
                    checked={limitMaxHeight} 
                    onCheckedChange={(c) => onLimitMaxHeightChange(c === true)} 
                  />
                  <label htmlFor="limit-max-height" className="text-sm text-white/70 cursor-pointer">
                    Limitar altura máxima
                  </label>
                </div>
                {limitMaxHeight && (
                  <div className="pl-7 pt-1 pb-2">
                    <p className="text-xs text-white/40 mb-2">Altura máxima ({maxHeightPixels}px)</p>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-white/20 text-white/60 hover:text-white hover:border-white/40 shrink-0"
                        onClick={() => onMaxHeightPixelsChange(Math.max(200, maxHeightPixels - 100))}
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
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-white/20 text-white/60 hover:text-white hover:border-white/40 shrink-0"
                        onClick={() => onMaxHeightPixelsChange(Math.min(4000, maxHeightPixels + 100))}
                        disabled={maxHeightPixels >= 4000}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <Separator className="bg-white/10" />

            {/* Filtros e Ajustes Visuais */}
            <section className="py-4">
              <div className="flex items-center justify-between mb-3">
                <SectionTitle>Filtros e Ajustes</SectionTitle>
                {onResetFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onResetFilters}
                    className="text-xs text-white/40 hover:text-white/70 h-auto py-1 px-2"
                  >
                    Restaurar padrões
                  </Button>
                )}
              </div>

              <SettingRow label="Sépia">
                <Switch checked={filterSepia} onCheckedChange={onFilterSepiaChange} />
              </SettingRow>
              <SettingRow label="Preto e Branco">
                <Switch checked={filterBW} onCheckedChange={onFilterBWChange} />
              </SettingRow>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs text-white/40 mb-1">Brilho ({brightness}%)</p>
                  <Slider
                    value={[brightness]}
                    onValueChange={([v]) => onBrightnessChange(v)}
                    min={0}
                    max={200}
                    step={1}
                  />
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">Contraste ({contrast}%)</p>
                  <Slider
                    value={[contrast]}
                    onValueChange={([v]) => onContrastChange(v)}
                    min={0}
                    max={200}
                    step={1}
                  />
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">Saturação ({saturation}%)</p>
                  <Slider
                    value={[saturation]}
                    onValueChange={([v]) => onSaturationChange(v)}
                    min={0}
                    max={200}
                    step={1}
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
