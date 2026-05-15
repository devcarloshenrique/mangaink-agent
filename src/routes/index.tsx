import { createFileRoute, Link } from "@tanstack/react-router";
import { ComicHeader } from "@/components/comic/Header";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { SpeechBubble } from "@/components/comic/SpeechBubble";
import { OnomatopoeiaBadge } from "@/components/comic/OnomatopoeiaBadge";
import {
  BookOpen,
  Download,
  ImageIcon,
  Mail,
  Send,
  Settings2,
  Sparkles,
  Tablet,
  Wand2,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MangaForge — Mangás direto pro seu Kindle" },
      {
        name: "description",
        content:
          "Cole a URL do mangá, escolha capítulos, capas e o perfil do seu Kindle. Receba EPUB, MOBI, KFX ou CBZ direto no seu leitor.",
      },
      { property: "og:title", content: "MangaForge — Mangás no seu Kindle" },
      {
        property: "og:description",
        content: "Wizard pop art em 5 passos. Otimizado pra Kindle Paperwhite, Oasis, Scribe e mais.",
      },
    ],
  }),
  component: Index,
});

const steps = [
  { icon: Download, title: "Origem", text: "Cole a URL do mangá e busque os capítulos." },
  { icon: BookOpen, title: "Capítulos", text: "Selecione tudo ou um a um. Junto ou separado." },
  { icon: ImageIcon, title: "Capas", text: "Por capítulo, por volume ou uma única pra tudo." },
  { icon: Settings2, title: "Conversão", text: "Perfil do Kindle, formato e preset (mangá, webtoon…)." },
  { icon: Send, title: "Envio", text: "Baixe ou mande direto pro seu e-mail Kindle." },
];

const features = [
  { icon: Tablet, title: "Perfis Kindle", text: "Paperwhite, Oasis, Scribe, Colorsoft, Fire HD e mais." },
  { icon: ImageIcon, title: "Capas flexíveis", text: "Mesma capa pra vários capítulos ou uma por volume." },
  { icon: Settings2, title: "Presets de mangá", text: "Otimizações pra mangá, webtoon, qualidade máxima." },
  { icon: Sparkles, title: "Créditos justos", text: "1 crédito por capítulo. Comece com 10 grátis." },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <ComicHeader />

      {/* HERO */}
      <section className="relative overflow-hidden border-b-[3px] border-ink bg-comic-yellow">
        <div className="absolute inset-0 bg-halftone opacity-30 pointer-events-none" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:py-24 md:grid-cols-2">
          <div className="space-y-6">
            <SpeechBubble variant="white" tail="bottom" className="max-w-xs">
              Otaku! Bora levar esse mangá pro Kindle?
            </SpeechBubble>
            <h1 className="font-display text-5xl md:text-7xl leading-[0.95] uppercase">
              Mangás,
              <br />
              <span className="inline-block bg-comic-red text-primary-foreground px-3 -rotate-2 border-[3px] border-ink shadow-comic mt-2">
                no seu Kindle!
              </span>
            </h1>
            <p className="max-w-md text-lg font-medium">
              Cole a URL, escolha os capítulos, ajuste pro modelo do seu Kindle e
              receba o arquivo direto no seu leitor. Sem dor de cabeça.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/wizard"
                className="inline-flex items-center gap-2 bg-comic-red text-primary-foreground border-[3px] border-ink shadow-comic px-6 py-3 rounded-md font-display text-2xl hover:-translate-y-1 transition-transform"
              >
                <Wand2 className="h-6 w-6" /> Começar agora
              </Link>
              <a
                href="#how"
                className="font-display text-xl underline decoration-[3px] underline-offset-4 hover:text-comic-red"
              >
                Como funciona ↓
              </a>
            </div>
            <div className="inline-flex items-center gap-2 mt-2 border-[3px] border-ink bg-card px-3 py-1 rounded-md shadow-comic-sm font-display">
              <Zap className="h-4 w-4 text-comic-red fill-current" />
              <span>10 créditos grátis ao criar conta</span>
            </div>
          </div>

          <div className="relative">
            <ComicPanel tilt="right" bg="card" className="relative z-10">
              <div className="bg-halftone-dense rounded-md aspect-[4/3] flex items-center justify-center">
                <div className="text-center space-y-3 px-4">
                  <div className="font-display text-5xl text-comic-red">DOKI!</div>
                  <p className="font-bold">Capítulos voando direto pro seu Kindle.</p>
                </div>
              </div>
            </ComicPanel>
            <div className="absolute -top-6 -right-4 z-20">
              <OnomatopoeiaBadge variant="red" size="lg">SUGOI!</OnomatopoeiaBadge>
            </div>
            <div className="absolute -bottom-6 -left-4 z-20">
              <OnomatopoeiaBadge variant="blue" size="md">ZAP!</OnomatopoeiaBadge>
            </div>
          </div>
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="border-b-[3px] border-ink py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-12">
            <span className="inline-block bg-comic-blue text-accent-foreground border-[3px] border-ink px-4 py-1 font-display text-xl -rotate-2 shadow-comic-sm">
              Como funciona
            </span>
            <h2 className="font-display text-4xl md:text-6xl mt-4 uppercase">
              Cinco passos, mangá no Kindle
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((s, i) => (
              <ComicPanel
                key={s.title}
                tilt={i % 2 === 0 ? "left" : "right"}
                bg={i === 2 ? "yellow" : "card"}
                className="relative"
              >
                <div className="absolute -top-4 -left-3 h-9 w-9 rounded-full border-[3px] border-ink bg-comic-red text-primary-foreground font-display text-lg flex items-center justify-center shadow-comic-sm">
                  {i + 1}
                </div>
                <s.icon className="h-8 w-8 mb-3" strokeWidth={2.5} />
                <h3 className="font-display text-2xl mb-1">{s.title}</h3>
                <p className="text-sm font-medium">{s.text}</p>
              </ComicPanel>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section
        id="features"
        className="border-b-[3px] border-ink py-16 md:py-24 bg-comic-cream relative"
      >
        <div className="absolute inset-0 bg-halftone opacity-20" />
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl md:text-6xl uppercase">
              Recursos <span className="text-comic-red">heróicos</span>
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <ComicPanel key={f.title} bg="card">
                <div className="h-12 w-12 mb-4 rounded-lg border-[3px] border-ink bg-comic-yellow flex items-center justify-center shadow-comic-sm">
                  <f.icon className="h-6 w-6" strokeWidth={2.5} />
                </div>
                <h3 className="font-display text-2xl mb-1">{f.title}</h3>
                <p className="text-sm font-medium">{f.text}</p>
              </ComicPanel>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-comic-red text-primary-foreground border-b-[3px] border-ink relative overflow-hidden">
        <div className="absolute inset-0 bg-halftone opacity-20" />
        <div className="relative mx-auto max-w-3xl px-4 text-center space-y-6">
          <OnomatopoeiaBadge variant="yellow" size="lg">BAM!</OnomatopoeiaBadge>
          <h2 className="font-display text-4xl md:text-6xl uppercase">
            Seu próximo mangá tá a um clique
          </h2>
          <p className="text-lg font-medium max-w-xl mx-auto">
            Crie sua conta, ganhe 10 créditos grátis e mande pro Kindle agora.
          </p>
          <Link
            to="/wizard"
            className="inline-flex items-center gap-2 bg-comic-yellow text-secondary-foreground border-[3px] border-ink shadow-comic px-6 py-3 rounded-md font-display text-2xl hover:-translate-y-1 transition-transform"
          >
            <Mail className="h-6 w-6" /> Mandar pro meu Kindle
          </Link>
        </div>
      </section>

      <footer className="py-8 text-center text-sm font-medium">
        Feito com tinta, papel e <span className="text-comic-red">muito KAPOW</span>.
      </footer>
    </div>
  );
}
