// Bridge for toast.html, the notification view laid over the top of the window.
const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (cb) => ipcRenderer.on(channel, (_e, payload) => cb(payload));

contextBridge.exposeInMainWorld('toast', {
  onShow: on('toast'),
  onPlaced: on('toast-placed'),
  onDismiss: on('toast-dismiss'),
  // The card's size (CSS px, shadow margin included), so main can fit the view to it.
  size: (width, height) => ipcRenderer.send('toast-size', { width, height }),
  hidden: () => ipcRenderer.send('toast-hidden'),
  action: (name) => ipcRenderer.send('toast-action', name),
});
