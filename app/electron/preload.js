const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, isolated API bridge to renderer
contextBridge.exposeInMainWorld('fridayAPI', {
  // App info & state
  getSystemInfo: () => ipcRenderer.invoke('system:getInfo'),
  
  // Audio & Voice hooks
  toggleMic: (listening) => ipcRenderer.invoke('voice:toggleMic', listening),
  speakText: (agentId, text) => ipcRenderer.invoke('voice:speak', { agentId, text }),
  
  // Intent & Command routing
  dispatchCommand: (command) => ipcRenderer.invoke('desk:command', command),
  
  // Real-time events from main process (feeds, logs, agent states)
  onSignalUpdate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('desk:signal', handler);
    return () => ipcRenderer.removeListener('desk:signal', handler);
  },
  onMarketPulseUpdate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('market:pulse', handler);
    return () => ipcRenderer.removeListener('market:pulse', handler);
  },
  onAgentStateChange: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('agent:state', handler);
    return () => ipcRenderer.removeListener('agent:state', handler);
  }
});
