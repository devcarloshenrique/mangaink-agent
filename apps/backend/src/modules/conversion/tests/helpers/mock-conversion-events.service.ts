import type { SSEEvent, SSEEventType } from '../../types/conversion.types'

export class MockConversionEventsService {
  public emitted: Array<{ channel: string; event: SSEEvent }> = []

  createEvent(type: SSEEventType, data: Record<string, unknown> = {}): SSEEvent {
    return {
      type,
      data,
      timestamp: new Date().toISOString(),
    }
  }

  async emit(channel: string, event: SSEEvent): Promise<void> {
    this.emitted.push({ channel, event })
  }

  reset(): void {
    this.emitted = []
  }
}
