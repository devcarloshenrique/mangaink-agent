/**
 * Tipos da API externa do Imperio da Britannia.
 *
 * Estes tipos refletem a estrutura das respostas JSON retornadas pela
 * API em api.imperiodabritannia.net. Não são tipos do domínio interno.
 */

// ─── Resposta de Obra (/api/obras/by-slug/{slug}) ──────────────────────────

export interface BritanniaObraTag {
  nome: string
}

export interface BritanniaCapitulo {
  numero: string
  nome: string | null
  total_paginas: number | null
  paywall: boolean
}

export interface BritanniaObra {
  id: number
  nome: string
  descricao: string | null
  imagem: string | null
  status_nome: string | null
  tags: BritanniaObraTag[]
  capitulos: BritanniaCapitulo[]
}

export interface BritanniaObraResponse {
  sucesso: boolean
  obra: BritanniaObra
}

// ─── Resposta de Capítulo (/api/obras/{id}/capitulos/{n}) ──────────────────

export interface BritanniaPagina {
  numero: number
  /** URL completa do CDN (ex: https://cdn.imperiodabritannia.net/...) */
  cdn_id: string
}

export interface BritanniaCapituloDetalhado {
  numero: string
  nome: string | null
  paginas: BritanniaPagina[]
  paywall: boolean
  paywall_bloqueado: boolean
  preco_moedas: number | null
  capitulo_anterior: { numero: string } | null
  capitulo_proximo: { numero: string } | null
}

export interface BritanniaCapituloResponse {
  sucesso: boolean
  capitulo: BritanniaCapituloDetalhado
}
