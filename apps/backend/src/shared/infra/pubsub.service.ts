/**
 * Contratos de pub/sub por canal — base da bridge SSE (fan-in).
 * Desacoplado do Redis (mode web) para suportar o modo embedded (desktop).
 */

/** Assinatura ativa de um ou mais canais. */
export interface UnsubscribeHandle {
  unsubscribe(): Promise<void>
}

/**
 * Pub/Sub por canal com suporte a fan-in (subscribeMany).
 * `message` é `any` pois o payload é serializado/deserializado pela implementação.
 */
export interface IPubSub {
  publish(channel: string, message: unknown): Promise<void>
  subscribe(channel: string, callback: (message: any) => void): Promise<UnsubscribeHandle>
  subscribeMany(
    channels: string[],
    callback: (channel: string, message: any) => void,
  ): Promise<UnsubscribeHandle>
  unsubscribe(channel: string, callback: (message: any) => void): Promise<void>
  unsubscribeMany(channels: string[]): Promise<void>
}
