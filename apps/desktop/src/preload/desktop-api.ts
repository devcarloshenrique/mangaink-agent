export interface DesktopApi {
  getStatus(): Promise<unknown>
  retry(): Promise<unknown>
  openLogs(): Promise<unknown>
  openExternal(url: string): Promise<unknown>
  getVersion(): Promise<string>
}

export interface DesktopApiDeps {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
}

export function createDesktopApi(deps: DesktopApiDeps): DesktopApi {
  const { invoke } = deps
  return {
    getStatus: () => invoke('desktop:get-status'),
    retry: () => invoke('desktop:retry'),
    openLogs: () => invoke('desktop:open-logs'),
    openExternal: (url: string) => invoke('desktop:open-external', url),
    getVersion: () => invoke('desktop:get-version') as Promise<string>,
  }
}
