/* global WebSocket, clearTimeout, fetch, setTimeout */

import process from 'node:process';

const pages = await fetch('http://127.0.0.1:9222/json').then((response) => response.json());
const page = pages.find(({ type }) => type === 'page');

if (!page) {
  throw new Error('No Chromium page target is available');
}

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

const expression = `JSON.stringify({
  title: document.title,
  url: location.href,
  visibility: document.visibilityState,
  text: document.body.innerText.slice(0, 2400),
  localStorage: Object.fromEntries(Object.entries(localStorage)),
  audio: [...document.querySelectorAll('audio')].map((element) => ({
    src: element.currentSrc || element.src,
    currentTime: element.currentTime,
    duration: element.duration,
    paused: element.paused,
    ended: element.ended,
    muted: element.muted,
    volume: element.volume,
    readyState: element.readyState,
    error: element.error?.message ?? null
  }))
})`;

const response = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('CDP evaluation timed out')), 5000);
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id !== 1) return;
    clearTimeout(timeout);
    resolve(message);
  });
  socket.send(
    JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression, returnByValue: true }
    })
  );
});

socket.close();
const value = response.result?.result?.value;
if (typeof value !== 'string') {
  throw new Error(response.result?.exceptionDetails?.text ?? 'CDP evaluation returned no value');
}
process.stdout.write(`${value}\n`);
