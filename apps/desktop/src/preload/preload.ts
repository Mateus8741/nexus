import { contextBridge, ipcRenderer } from "electron";

import { type AgentStatus, IPC, type NexusBridge, type Snapshot } from "../shared/types";

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_event: unknown, value: T): void => listener(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const bridge: NexusBridge = {
  platform: process.platform,
  getSnapshot: () => ipcRenderer.invoke(IPC.getSnapshot),
  onSnapshot: (listener) => subscribe<Snapshot>(IPC.snapshot, listener),
  refresh: () => ipcRenderer.invoke(IPC.refresh),
  runActions: (requests) => ipcRenderer.invoke(IPC.runActions, requests),
  getConfig: () => ipcRenderer.invoke(IPC.getConfig),
  saveConfig: (input) => ipcRenderer.invoke(IPC.saveConfig, input),
  testConnection: (coreUrl, apiKey) => ipcRenderer.invoke(IPC.testConnection, coreUrl, apiKey),
  getAgentStatus: () => ipcRenderer.invoke(IPC.getAgentStatus),
  onAgentStatus: (listener) => subscribe<AgentStatus>(IPC.agentStatus, listener),
  setPinned: (pinned) => ipcRenderer.invoke(IPC.setPinned, pinned),
  onPinned: (listener) => subscribe<boolean>(IPC.pinned, listener),
  hideWidget: () => ipcRenderer.send(IPC.hideWidget),
  openSettings: () => ipcRenderer.send(IPC.openSettings),
  closeSettings: () => ipcRenderer.send(IPC.closeSettings),
  quit: () => ipcRenderer.send(IPC.quit),
  getVersion: () => ipcRenderer.invoke(IPC.getVersion),
};

contextBridge.exposeInMainWorld("nexus", bridge);
