// lib/sse.ts — SSE via fetch streaming (suporta Authorization header)
// Usar EventSource nativo não permite headers customizados.

interface SSEHandlers {
  onEvent: (event: string, data: unknown) => void;
  onError?: (error: Error) => void;
}

/**
 * Abre um stream SSE usando fetch (suporta Authorization header).
 * @returns { close } — chama close() para abortar o stream.
 */
export function createSSEStream(
  url: string,
  handlers: SSEHandlers,
  token?: string,
): { close: () => void } {
  const controller = new AbortController();

  const headers: HeadersInit = {
    Accept: "text/event-stream",
    "Cache-Control": "no-cache",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  fetch(url, { headers, signal: controller.signal })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`SSE error: HTTP ${response.status}`);
      }
      if (!response.body) {
        throw new Error("SSE error: response body is null");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames separados por \n\n
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          if (!frame.trim()) continue;

          const lines = frame.split("\n");
          let event = "message";
          let dataStr = "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              event = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataStr += line.slice(5).trim();
            } else if (line.startsWith(":")) {
              // comment / keepalive — ignorar
            }
          }

          if (event !== "message" || dataStr) {
            try {
              const data = dataStr ? JSON.parse(dataStr) : {};
              handlers.onEvent(event, data);
            } catch {
              handlers.onEvent(event, dataStr);
            }
          }
        }
      }
    })
    .catch((err: Error) => {
      if (err.name !== "AbortError") {
        handlers.onError?.(err);
      }
    });

  return { close: () => controller.abort() };
}
