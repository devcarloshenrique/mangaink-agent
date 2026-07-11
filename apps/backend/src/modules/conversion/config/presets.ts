import type { ConversionPreset } from '../types/conversion.types'

export const presets: ConversionPreset[] = [
  {
    id: 'manga',
    name: 'Mangá',
    description: 'Leitura da direita para esquerda com recorte automático.',
    values: {
      mangaMode: true,
      cropping: 'marginsAndPageNumbers',
      stretchMode: 'upscale',
    },
  },
  {
    id: 'webtoon',
    name: 'Webtoon',
    description: 'Processamento para tiras longas verticais.',
    values: {
      webtoonMode: true,
      cropping: 'margins',
      stretchMode: 'stretch',
    },
  },
  {
    id: 'comic',
    name: 'HQ Ocidental',
    description: 'Leitura esquerda para direita sem modificações extras.',
    values: {
      cropping: 'marginsAndPageNumbers',
    },
  },
  {
    id: 'highQuality',
    name: 'Alta Qualidade',
    description: 'Algoritmos de redimensionamento de maior qualidade.',
    values: {
      highQuality: true,
      stretchMode: 'upscale',
    },
  },
  {
    id: 'noProcessing',
    name: 'Sem Processamento',
    description: 'Apenas converte sem otimizar imagens. Ignora todos os outros campos.',
    exclusive: true,
    values: {
      noProcessing: true,
    },
  },
]