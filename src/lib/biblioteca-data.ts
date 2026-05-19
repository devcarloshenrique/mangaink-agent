export type ConversionStatus = "completed" | "pending" | "error" | "converting";

export interface Chapter {
  id: string;
  number: string;
  title: string;
  status: ConversionStatus;
}

export interface MangaFile {
  id: string;
  name: string;
  bytes: number;
  when: string;
  format: "EPUB" | "MOBI" | "PDF" | "CBZ" | "KFX";
  sent: boolean;
  status: ConversionStatus;
  chapters: Chapter[];
}

export interface MangaSeries {
  slug: string;
  title: string;
  author: string;
  hue: number;
  files: MangaFile[];
  lastConverted: string;
  favorite: boolean;
  tags: string[];
  addedAt: string;
}

export const INITIAL_SERIES: MangaSeries[] = [
  {
    slug: "berserk",
    title: "Berserk",
    author: "Kentaro Miura",
    hue: 0,
    lastConverted: "há 2h",
    favorite: true,
    tags: ["seinen", "ação", "fantasia sombria"],
    addedAt: "2026-05-10T10:00:00Z",
    files: [
      {
        id: "berserk-vol-01",
        name: "berserk-vol-01.epub",
        bytes: 12582912,
        when: "há 2h",
        format: "EPUB",
        sent: true,
        status: "completed",
        chapters: [
          { id: "ch-01", number: "1", title: "O Espadachim Negro", status: "completed" },
          { id: "ch-02", number: "2", title: "O Grupo da Águia", status: "completed" },
          { id: "ch-03", number: "3", title: "A Lâmina do Mal", status: "completed" },
          { id: "ch-04", number: "4", title: "O Pacto", status: "completed" },
          { id: "ch-05", number: "5", title: "O Torneio", status: "completed" },
        ],
      },
      {
        id: "berserk-vol-02",
        name: "berserk-vol-02.epub",
        bytes: 14680064,
        when: "há 2h",
        format: "EPUB",
        sent: true,
        status: "completed",
        chapters: [
          { id: "ch-06", number: "6", title: "O Cerco", status: "completed" },
          { id: "ch-07", number: "7", title: "O Assalto Noturno", status: "completed" },
          { id: "ch-08", number: "8", title: "O Resgate", status: "completed" },
          { id: "ch-09", number: "9", title: "A Traição", status: "completed" },
        ],
      },
      {
        id: "berserk-vol-03",
        name: "berserk-vol-03.epub",
        bytes: 11534336,
        when: "há 3h",
        format: "EPUB",
        sent: false,
        status: "completed",
        chapters: [
          { id: "ch-10", number: "10", title: "O Eclipse - Parte 1", status: "completed" },
          { id: "ch-11", number: "11", title: "O Eclipse - Parte 2", status: "completed" },
          { id: "ch-12", number: "12", title: "O Eclipse - Parte 3", status: "completed" },
        ],
      },
    ],
  },
  {
    slug: "vagabond",
    title: "Vagabond",
    author: "Takehiko Inoue",
    hue: 35,
    lastConverted: "ontem",
    favorite: false,
    tags: ["seinen", "ação", "histórico"],
    addedAt: "2026-05-08T14:30:00Z",
    files: [
      {
        id: "vagabond-vol-01",
        name: "vagabond-vol-01.epub",
        bytes: 10485760,
        when: "ontem",
        format: "EPUB",
        sent: true,
        status: "completed",
        chapters: [
          { id: "vch-01", number: "1", title: "A Criança Monstro", status: "completed" },
          { id: "vch-02", number: "2", title: "O Duelo", status: "completed" },
          { id: "vch-03", number: "3", title: "O Encontro", status: "completed" },
        ],
      },
      {
        id: "vagabond-vol-02",
        name: "vagabond-vol-02.epub",
        bytes: 9437184,
        when: "ontem",
        format: "EPUB",
        sent: false,
        status: "completed",
        chapters: [
          { id: "vch-04", number: "4", title: "Musashi", status: "completed" },
          { id: "vch-05", number: "5", title: "O Caminho", status: "completed" },
          { id: "vch-06", number: "6", title: "A Flor", status: "completed" },
          { id: "vch-07", number: "7", title: "O Templo", status: "completed" },
        ],
      },
    ],
  },
  {
    slug: "one-piece",
    title: "One Piece",
    author: "Eiichiro Oda",
    hue: 200,
    lastConverted: "3 dias",
    favorite: true,
    tags: ["shonen", "ação", "aventura"],
    addedAt: "2026-05-05T08:00:00Z",
    files: [
      {
        id: "op-vol-01",
        name: "one-piece-vol-01.epub",
        bytes: 15728640,
        when: "3 dias",
        format: "EPUB",
        sent: true,
        status: "completed",
        chapters: [
          { id: "och-01", number: "1", title: "Romance Dawn", status: "completed" },
          { id: "och-02", number: "2", title: "Eles Chamam Luffy", status: "completed" },
          { id: "och-03", number: "3", title: "Zoro, o Caçador de Piratas", status: "completed" },
          { id: "och-04", number: "4", title: "O Grande Marinheiro", status: "completed" },
        ],
      },
      {
        id: "op-vol-02",
        name: "one-piece-vol-02.epub",
        bytes: 13631488,
        when: "3 dias",
        format: "EPUB",
        sent: true,
        status: "completed",
        chapters: [
          { id: "och-05", number: "5", title: "Nami", status: "completed" },
          { id: "och-06", number: "6", title: "O Primeiro Tripulante", status: "completed" },
          { id: "och-07", number: "7", title: "O Retorno", status: "completed" },
        ],
      },
      {
        id: "op-vol-03",
        name: "one-piece-vol-03.epub",
        bytes: 14155776,
        when: "4 dias",
        format: "EPUB",
        sent: false,
        status: "completed",
        chapters: [
          { id: "och-08", number: "8", title: "Goat Barrel", status: "completed" },
          { id: "och-09", number: "9", title: "A Mentira", status: "completed" },
          { id: "och-10", number: "10", title: "O Mentiroso", status: "completed" },
          { id: "och-11", number: "11", title: "A Vila", status: "completed" },
          { id: "och-12", number: "12", title: "O Incidente", status: "completed" },
        ],
      },
      {
        id: "op-vol-04",
        name: "one-piece-vol-04.epub",
        bytes: 16252928,
        when: "5 dias",
        format: "EPUB",
        sent: false,
        status: "error",
        chapters: [
          { id: "och-13", number: "13", title: "Medo", status: "completed" },
          { id: "och-14", number: "14", title: "O Segredo", status: "error" },
          { id: "och-15", number: "15", title: "O Pacto", status: "pending" },
        ],
      },
    ],
  },
  {
    slug: "vinland-saga",
    title: "Vinland Saga",
    author: "Makoto Yukimura",
    hue: 140,
    lastConverted: "há 5h",
    favorite: false,
    tags: ["seinen", "ação", "histórico", "aventura"],
    addedAt: "2026-05-11T16:00:00Z",
    files: [
      {
        id: "vs-vol-01",
        name: "vinland-saga-vol-01.epub",
        bytes: 11010048,
        when: "há 5h",
        format: "EPUB",
        sent: false,
        status: "completed",
        chapters: [
          { id: "vsch-01", number: "1", title: "Algo para Matar", status: "completed" },
          { id: "vsch-02", number: "2", title: "O Ataque Viking", status: "completed" },
          { id: "vsch-03", number: "3", title: "O Navio", status: "completed" },
          { id: "vsch-04", number: "4", title: "O Campo de Batalha", status: "completed" },
        ],
      },
      {
        id: "vs-vol-02",
        name: "vinland-saga-vol-02.epub",
        bytes: 12058624,
        when: "há 6h",
        format: "EPUB",
        sent: false,
        status: "completed",
        chapters: [
          { id: "vsch-05", number: "5", title: "O Guerreiro", status: "completed" },
          { id: "vsch-06", number: "6", title: "A Batalha de Londres", status: "completed" },
          { id: "vsch-07", number: "7", title: "O Escravo", status: "completed" },
        ],
      },
    ],
  },
  {
    slug: "chainsaw-man",
    title: "Chainsaw Man",
    author: "Tatsuki Fujimoto",
    hue: 15,
    lastConverted: "ontem",
    favorite: false,
    tags: ["shonen", "ação", "sobrenatural"],
    addedAt: "2026-05-09T12:00:00Z",
    files: [
      {
        id: "csm-vol-01",
        name: "chainsaw-man-vol-01.epub",
        bytes: 8388608,
        when: "ontem",
        format: "EPUB",
        sent: true,
        status: "completed",
        chapters: [
          { id: "csm-ch-01", number: "1", title: "Cachorro e Motosserra", status: "completed" },
          {
            id: "csm-ch-02",
            number: "2",
            title: "O Escritório de Caça a Demônios",
            status: "completed",
          },
          { id: "csm-ch-03", number: "3", title: "Aki-chan", status: "completed" },
        ],
      },
      {
        id: "csm-vol-02",
        name: "chainsaw-man-vol-02.epub",
        bytes: 9175040,
        when: "ontem",
        format: "EPUB",
        sent: false,
        status: "completed",
        chapters: [
          { id: "csm-ch-04", number: "4", title: "Resgate", status: "completed" },
          { id: "csm-ch-05", number: "5", title: "O Demônio da Aranha", status: "completed" },
          { id: "csm-ch-06", number: "6", title: "Matar Denji", status: "completed" },
          { id: "csm-ch-07", number: "7", title: "O Sabor de um Beijo", status: "completed" },
        ],
      },
      {
        id: "csm-vol-03",
        name: "chainsaw-man-vol-03.epub",
        bytes: 8912896,
        when: "2 dias",
        format: "EPUB",
        sent: false,
        status: "completed",
        chapters: [
          { id: "csm-ch-08", number: "8", title: "Tiro", status: "completed" },
          { id: "csm-ch-09", number: "9", title: "De Kyoto", status: "completed" },
          { id: "csm-ch-10", number: "10", title: "Treinamento Intenso", status: "completed" },
        ],
      },
    ],
  },
  {
    slug: "monster",
    title: "Monster",
    author: "Naoki Urasawa",
    hue: 280,
    lastConverted: "1 semana",
    favorite: false,
    tags: ["seinen", "suspense", "psicológico"],
    addedAt: "2026-05-01T09:00:00Z",
    files: [
      {
        id: "mon-vol-01",
        name: "monster-vol-01.epub",
        bytes: 14942208,
        when: "1 semana",
        format: "EPUB",
        sent: true,
        status: "completed",
        chapters: [
          { id: "mch-01", number: "1", title: "Hamburgo", status: "completed" },
          { id: "mch-02", number: "2", title: "O Bisturi", status: "completed" },
          { id: "mch-03", number: "3", title: "A Operação", status: "completed" },
          { id: "mch-04", number: "4", title: "O Despertar", status: "completed" },
          { id: "mch-05", number: "5", title: "O Assassino", status: "completed" },
        ],
      },
      {
        id: "mon-vol-02",
        name: "monster-vol-02.epub",
        bytes: 15204352,
        when: "1 semana",
        format: "EPUB",
        sent: false,
        status: "completed",
        chapters: [
          { id: "mch-06", number: "6", title: "A Menina do Parque", status: "completed" },
          { id: "mch-07", number: "7", title: "O Hospital", status: "completed" },
          { id: "mch-08", number: "8", title: "A Fuga", status: "completed" },
          { id: "mch-09", number: "9", title: "O Passado", status: "completed" },
        ],
      },
      {
        id: "mon-vol-03",
        name: "monster-vol-03.epub",
        bytes: 13893632,
        when: "1 semana",
        format: "EPUB",
        sent: false,
        status: "completed",
        chapters: [
          { id: "mch-10", number: "10", title: "A Busca", status: "completed" },
          { id: "mch-11", number: "11", title: "O Encontro", status: "completed" },
          { id: "mch-12", number: "12", title: "A Decisão", status: "completed" },
        ],
      },
      {
        id: "mon-vol-04",
        name: "monster-vol-04.epub",
        bytes: 14417920,
        when: "1 semana",
        format: "EPUB",
        sent: false,
        status: "completed",
        chapters: [
          { id: "mch-13", number: "13", title: "A Cidade", status: "completed" },
          { id: "mch-14", number: "14", title: "O Segredo", status: "completed" },
          { id: "mch-15", number: "15", title: "A Revelação", status: "completed" },
          { id: "mch-16", number: "16", title: "O Monstro", status: "completed" },
        ],
      },
    ],
  },
];
