import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MangaFile, MangaSeries, ConversionStatus } from "@/lib/biblioteca-data";

interface Props {
  series: MangaSeries;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReconvertFile: (fileId: string) => void;
  onReconvertChapters: (fileId: string, chapterIds: string[]) => void;
}

function statusLabel(s: ConversionStatus): string {
  const map: Record<ConversionStatus, string> = {
    completed: "Concluído",
    pending: "Pendente",
    error: "Erro",
    converting: "Convertendo",
  };
  return map[s];
}

function statusColor(s: ConversionStatus): string {
  const map: Record<ConversionStatus, string> = {
    completed: "bg-comic-blue",
    pending: "bg-comic-yellow",
    error: "bg-comic-red",
    converting: "bg-comic-blue animate-pulse",
  };
  return map[s];
}

export function ReconvertDialog({
  series,
  open,
  onOpenChange,
  onReconvertFile,
  onReconvertChapters,
}: Props) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [selectedChapters, setSelectedChapters] = useState<Record<string, Set<string>>>({});

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setExpandedFile(null);
      setSelectedChapters({});
    }
    onOpenChange(o);
  };

  const toggleFileExpand = (fileId: string) => {
    setExpandedFile((prev) => (prev === fileId ? null : fileId));
  };

  const toggleChapter = (fileId: string, chapterId: string) => {
    setSelectedChapters((prev) => {
      const fileSet = new Set(prev[fileId] ?? []);
      if (fileSet.has(chapterId)) {
        fileSet.delete(chapterId);
      } else {
        fileSet.add(chapterId);
      }
      return { ...prev, [fileId]: fileSet };
    });
  };

  const handleReconvertFile = (fileId: string) => {
    onReconvertFile(fileId);
  };

  const handleReconvertSelectedChapters = (fileId: string) => {
    const ids = Array.from(selectedChapters[fileId] ?? []);
    if (ids.length > 0) {
      onReconvertChapters(fileId, ids);
    }
  };

  const hasSelectedChapters = Object.values(selectedChapters).some((s) => s.size > 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-[3px] border-ink shadow-comic-lg sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <RefreshCw className="h-5 w-5" /> Reconverter — {series.title}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="volumes" className="w-full">
          <TabsList className="grid w-full grid-cols-2 border-[3px] border-ink">
            <TabsTrigger
              value="volumes"
              className="font-display data-[state=active]:bg-comic-red data-[state=active]:text-primary-foreground"
            >
              Volume inteiro
            </TabsTrigger>
            <TabsTrigger
              value="chapters"
              className="font-display data-[state=active]:bg-comic-red data-[state=active]:text-primary-foreground"
            >
              Capítulos específicos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="volumes" className="space-y-2 mt-4">
            <p className="text-sm font-medium opacity-70 mb-3">
              Selecione os volumes para reconverter:
            </p>
            {series.files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 border-[3px] border-ink rounded-lg p-3 bg-card shadow-comic-sm"
              >
                <div
                  className={cn(
                    "h-3 w-3 rounded-full border-2 border-ink shrink-0",
                    statusColor(f.status),
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-display text-base truncate">{f.name}</p>
                  <p className="text-xs font-medium opacity-70">
                    {f.format} • {(f.bytes / 1024 / 1024).toFixed(1)} MB • {f.chapters.length}{" "}
                    capítulos • {statusLabel(f.status)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReconvertFile(f.id)}
                  className="border-[2.5px] border-ink shadow-comic-sm font-display shrink-0"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reconverter
                </Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="chapters" className="space-y-2 mt-4">
            <p className="text-sm font-medium opacity-70 mb-3">
              Expanda um volume e selecione os capítulos:
            </p>
            {series.files.map((f) => {
              const isExpanded = expandedFile === f.id;
              const fileSelectedChapters = selectedChapters[f.id] ?? new Set();
              const allChaptersSelected =
                fileSelectedChapters.size === f.chapters.length && f.chapters.length > 0;

              return (
                <div
                  key={f.id}
                  className="border-[3px] border-ink rounded-lg bg-card shadow-comic-sm overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleFileExpand(f.id)}
                    className="flex items-center gap-3 w-full p-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    <div
                      className={cn(
                        "h-3 w-3 rounded-full border-2 border-ink shrink-0",
                        statusColor(f.status),
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-base truncate">{f.name}</p>
                      <p className="text-xs font-medium opacity-70">
                        {f.chapters.length} capítulos • {fileSelectedChapters.size} selecionado(s)
                      </p>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t-[3px] border-ink p-2 space-y-1">
                      <label className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-muted/50 rounded text-sm font-medium">
                        <Checkbox
                          checked={allChaptersSelected}
                          onCheckedChange={() => {
                            if (allChaptersSelected) {
                              setSelectedChapters((prev) => ({ ...prev, [f.id]: new Set() }));
                            } else {
                              setSelectedChapters((prev) => ({
                                ...prev,
                                [f.id]: new Set(f.chapters.map((ch) => ch.id)),
                              }));
                            }
                          }}
                          className="border-[2px] border-ink data-[state=checked]:bg-comic-red data-[state=checked]:border-ink"
                        />
                        Selecionar todos
                      </label>
                      {f.chapters.map((ch) => (
                        <label
                          key={ch.id}
                          className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/50 rounded"
                        >
                          <Checkbox
                            checked={fileSelectedChapters.has(ch.id)}
                            onCheckedChange={() => toggleChapter(f.id, ch.id)}
                            className="border-[2px] border-ink data-[state=checked]:bg-comic-red data-[state=checked]:border-ink"
                          />
                          <div
                            className={cn(
                              "h-2.5 w-2.5 rounded-full border-2 border-ink shrink-0",
                              statusColor(ch.status),
                            )}
                          />
                          <span className="font-display text-sm">Cap. {ch.number}</span>
                          <span className="text-xs font-medium opacity-70 truncate flex-1">
                            {ch.title}
                          </span>
                          <span className="text-[10px] font-medium opacity-60 shrink-0">
                            {statusLabel(ch.status)}
                          </span>
                        </label>
                      ))}
                      <div className="pt-2 px-2">
                        <Button
                          size="sm"
                          onClick={() => handleReconvertSelectedChapters(f.id)}
                          disabled={fileSelectedChapters.size === 0}
                          className="bg-comic-red text-primary-foreground hover:bg-comic-red border-[2.5px] border-ink shadow-comic-sm font-display disabled:opacity-40"
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                          Reconverter {fileSelectedChapters.size} capítulo(s)
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[3px] border-ink shadow-comic-sm font-display"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
