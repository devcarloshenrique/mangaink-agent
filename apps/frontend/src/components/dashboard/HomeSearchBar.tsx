import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface HomeSearchBarProps {
  query: string;
  onChange: (value: string) => void;
  isFetching: boolean;
}

export function HomeSearchBar({ query, onChange, isFetching }: HomeSearchBarProps) {
  return (
    <section aria-label="Buscar mangá">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 opacity-60" />
        <Input
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && query) onChange("");
          }}
          placeholder="Buscar mangá — ex.: one piece"
          aria-label="Buscar mangá"
          className="h-11 border-[3px] border-ink bg-background pl-10 pr-16"
        />
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          {isFetching && <Loader2 className="h-5 w-5 animate-spin opacity-60" />}
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="Limpar busca"
              title="Limpar busca"
              className="grid h-6 w-6 place-items-center rounded-full border-[2px] border-ink bg-card opacity-70 transition hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" strokeWidth={3} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
