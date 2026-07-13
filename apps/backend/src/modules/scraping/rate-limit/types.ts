import type Bottleneck from 'bottleneck'

export interface RateLimiterConfig {
  maxConcurrent: number
  minTime: number
  reservoir?: number
  reservoirRefreshInterval?: number
}

export type RateLimiter = Bottleneck
