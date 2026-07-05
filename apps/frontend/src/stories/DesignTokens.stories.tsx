import type { Meta } from "@storybook/react";

export default {
  title: "Design System/Tokens",
  parameters: {
    layout: "padded",
  },
} satisfies Meta;

export function Colors() {
  const colors = [
    { name: "Comic Yellow", var: "--comic-yellow", hex: "#FFD700", desc: "Cor primária, destaque" },
    { name: "Comic Red", var: "--comic-red", hex: "#E53935", desc: "Ações principais, perigo" },
    { name: "Comic Blue", var: "--comic-blue", hex: "#1E88E5", desc: "Links, info, progresso" },
    { name: "Comic Cream", var: "--comic-cream", hex: "#FAF9F6", desc: "Background claro" },
    { name: "Comic Ink", var: "--comic-ink", hex: "#1A1A1A", desc: "Texto, bordas" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl uppercase mb-4">Cores do Tema</h2>
        <p className="text-sm font-medium opacity-70 mb-6">
          Cores definidas em <code className="bg-muted px-1 rounded">src/styles.css</code> usando oklch.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {colors.map((c) => (
          <div key={c.var} className="border-[3px] border-ink rounded-xl shadow-comic-sm overflow-hidden">
            <div
              className="h-24 border-b-[3px] border-ink"
              style={{ background: c.hex }}
            />
            <div className="p-4">
              <p className="font-display text-xl">{c.name}</p>
              <p className="text-xs font-mono opacity-60 mt-1">{c.var}</p>
              <p className="text-xs font-mono opacity-60">{c.hex}</p>
              <p className="text-xs font-medium opacity-70 mt-2">{c.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Typography() {
  return (
    <div className="space-y-6">
      <h2 className="font-display text-3xl uppercase mb-4">Tipografia</h2>
      <div className="space-y-4">
        <div className="border-[3px] border-ink rounded-xl p-6 shadow-comic-sm">
          <p className="text-xs font-mono opacity-50 mb-2">font-display (Bangers)</p>
          <p className="font-display text-6xl">MangaForge</p>
          <p className="font-display text-4xl mt-2">Títulos e Destaques</p>
          <p className="font-display text-2xl mt-2">ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
          <p className="font-display text-lg mt-1">abcdefghijklmnopqrstuvwxyz 0123456789</p>
        </div>
        <div className="border-[3px] border-ink rounded-xl p-6 shadow-comic-sm">
          <p className="text-xs font-mono opacity-50 mb-2">font-sans (Inter)</p>
          <p className="text-4xl">MangaForge</p>
          <p className="text-2xl mt-2">Texto Corpo e Interface</p>
          <p className="text-lg mt-2">ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
          <p className="text-base mt-1">abcdefghijklmnopqrstuvwxyz 0123456789</p>
          <p className="text-sm mt-2 opacity-70">
            O Inter é usado para textos de corpo, labels, descrições e elementos de interface.
            Legível em todos os tamanhos.
          </p>
        </div>
      </div>
    </div>
  );
}

export function Shadows() {
  return (
    <div className="space-y-6">
      <h2 className="font-display text-3xl uppercase mb-4">Sombras</h2>
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="border-[3px] border-ink rounded-xl p-6 shadow-comic-sm bg-card">
          <p className="font-display text-xl">shadow-comic-sm</p>
          <p className="text-xs font-mono opacity-50 mt-1">3px offset</p>
          <p className="text-sm opacity-70 mt-2">Para cards e elementos pequenos</p>
        </div>
        <div className="border-[3px] border-ink rounded-xl p-6 shadow-comic bg-card">
          <p className="font-display text-xl">shadow-comic</p>
          <p className="text-xs font-mono opacity-50 mt-1">6px offset</p>
          <p className="text-sm opacity-70 mt-2">Para botões e elementos interativos</p>
        </div>
        <div className="border-[3px] border-ink rounded-xl p-6 shadow-comic-lg bg-card">
          <p className="font-display text-xl">shadow-comic-lg</p>
          <p className="text-xs font-mono opacity-50 mt-1">10px offset</p>
          <p className="text-sm opacity-70 mt-2">Para modais e popups</p>
        </div>
      </div>
    </div>
  );
}

export function Animations() {
  return (
    <div className="space-y-6">
      <h2 className="font-display text-3xl uppercase mb-4">Animações</h2>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="border-[3px] border-ink rounded-xl p-6 shadow-comic-sm bg-card">
          <p className="font-display text-xl">animate-comic-pop</p>
          <p className="text-sm opacity-70 mt-2">Efeito pop ao aparecer</p>
          <div className="mt-4 animate-comic-pop inline-block border-[3px] border-ink rounded-lg px-4 py-2 bg-comic-yellow font-display">
            POP!
          </div>
        </div>
        <div className="border-[3px] border-ink rounded-xl p-6 shadow-comic-sm bg-card">
          <p className="font-display text-xl">animate-comic-shake</p>
          <p className="text-sm opacity-70 mt-2">Efeito tremor para loading</p>
          <div className="mt-4 animate-comic-shake inline-block border-[3px] border-ink rounded-lg px-4 py-2 bg-comic-yellow font-display">
            SHAKE!
          </div>
        </div>
      </div>
    </div>
  );
}

export function Borders() {
  return (
    <div className="space-y-6">
      <h2 className="font-display text-3xl uppercase mb-4">Bordas</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="border-[3px] border-ink rounded-xl p-6 shadow-comic-sm bg-card">
          <p className="font-display text-lg">border-ink</p>
          <p className="text-xs font-mono opacity-50 mt-1">3px solid</p>
          <p className="text-sm opacity-70 mt-2">Borda padrão dos componentes</p>
        </div>
        <div className="border-[3px] border-dashed border-ink rounded-xl p-6 shadow-comic-sm bg-card">
          <p className="font-display text-lg">border-dashed</p>
          <p className="text-xs font-mono opacity-50 mt-1">3px dashed</p>
          <p className="text-sm opacity-70 mt-2">Separadores e áreas de drop</p>
        </div>
        <div className="border-[3px] border-dotted border-ink rounded-xl p-6 shadow-comic-sm bg-card">
          <p className="font-display text-lg">border-dotted</p>
          <p className="text-xs font-mono opacity-50 mt-1">3px dotted</p>
          <p className="text-sm opacity-70 mt-2">Decoração sutil</p>
        </div>
      </div>
    </div>
  );
}
