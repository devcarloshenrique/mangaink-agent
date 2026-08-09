import type { ProgressMessage } from '../../services/source-events.service'

export class MockRedisPubSubService {
  publishedMessages: Array<{ sourceId: string; message: ProgressMessage }> = []

  async publish(sourceId: string, message: ProgressMessage): Promise<void> {
    this.publishedMessages.push({ sourceId, message })
  }

  subscribe(
    _sourceId: string,
    _onMessage: (message: ProgressMessage) => void,
  ): { unsubscribe: () => Promise<void> } {
    return {
      unsubscribe: async () => {},
    }
  }

  reset(): void {
    this.publishedMessages = []
  }
}