import { describe, expect, it, vi } from 'vitest'
import { createDesktopApi } from '../preload/desktop-api'

describe('createDesktopApi', () => {
  it('expõe exatamente as 5 chaves de window.desktop', () => {
    const invoke = vi.fn()
    const api = createDesktopApi({ invoke })
    expect(Object.keys(api)).toEqual(['getStatus', 'retry', 'openLogs', 'openExternal', 'getVersion'])
  })

  it('getStatus() chama invoke com desktop:get-status', () => {
    const invoke = vi.fn()
    const api = createDesktopApi({ invoke })
    api.getStatus()
    expect(invoke).toHaveBeenCalledWith('desktop:get-status')
  })

  it('openExternal(url) chama invoke com desktop:open-external e a url', () => {
    const invoke = vi.fn()
    const api = createDesktopApi({ invoke })
    api.openExternal('https://exemplo.com')
    expect(invoke).toHaveBeenCalledWith('desktop:open-external', 'https://exemplo.com')
  })

  it('retry/openLogs/getVersion encaminham para os canais corretos', () => {
    const invoke = vi.fn()
    const api = createDesktopApi({ invoke })
    api.retry()
    api.openLogs()
    api.getVersion()
    expect(invoke).toHaveBeenNthCalledWith(1, 'desktop:retry')
    expect(invoke).toHaveBeenNthCalledWith(2, 'desktop:open-logs')
    expect(invoke).toHaveBeenNthCalledWith(3, 'desktop:get-version')
  })
})
