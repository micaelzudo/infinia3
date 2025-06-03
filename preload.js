// preload.js

// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
window.addEventListener('DOMContentLoaded', () => {
  // You can expose specific Node.js functionalities to the renderer process here
  // in a controlled way using contextBridge if needed.
  // For example:
  // const { contextBridge } = require('electron');
  // contextBridge.exposeInMainWorld('myAPI', { 
  //   doSomething: () => { console.log('Done!') }
  // });
  console.log('Preload script loaded.');
}); 