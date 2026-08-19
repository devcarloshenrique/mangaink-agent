// lib/sse.ts — SSE via fetch streaming (suporta Authorization header)
// Usar EventSource nativo não permite headers customizados.

interface SSEHandlers {
  onEvent: (event: string, data: unknown) => void;
  onError?: (error: Error) => void;
}

/**
 * Abre um stream SSE usando fetch (suporta Authorization header e cookie httpOnly).
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

  // credentials: "include" envia o cookie httpOnly de sessão (VULN-10) —
  // permite SSE autenticado via cookie quando não há token em memória.
  fetch(url, { headers, signal: controller.signal, credentials: "include" })
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

      const processFrame = (frame: string) => {
        if (!frame.trim()) return;

        const lines = frame.split(/\r?\n/);
        let event = "message";
        let dataStr = "";

        for (const line of lines) {
          const trimmed = line.trimStart();
          if (trimmed.startsWith("event:")) {
            event = trimmed.slice(6).trim();
          } else if (trimmed.startsWith("data:")) {
            dataStr += trimmed.slice(5).trim();
          } else if (trimmed.startsWith(":")) {
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
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            processFrame(buffer);
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // SSE frames separados por \r\n\r\n ou \n\n
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          processFrame(frame);
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
