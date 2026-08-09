import { contextBridge, ipcRenderer } from 'electron'
import { createDesktopApi } from './desktop-api'

contextBridge.exposeInMainWorld(
  'desktop',
  createDesktopApi({
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  }),
)
