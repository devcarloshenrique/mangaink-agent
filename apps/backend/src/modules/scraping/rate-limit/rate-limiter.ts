import Bottleneck from 'bottleneck'
import type { RateLimiterConfig, RateLimiter } from './types'

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  return new Bottleneck({
    maxConcurrent: config.maxConcurrent,
    minTime: config.minTime,
    reservoir: config.reservoir,
    reservoirRefreshInterval: config.reservoirRefreshInterval,
    highWater: 100,
    strategy: Bottleneck.strategy.LEAK,
  })
}
