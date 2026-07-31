const historyKey = 'elsewhere-cable.played-segments.v1';
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

const expression = `(() => {
  const key = ${JSON.stringify(historyKey)};
  const stored = localStorage.getItem(key) ?? '[]';
  let playedCount = 0;
  try {
    const parsed = JSON.parse(stored);
    playedCount = Array.isArray(parsed) ? parsed.length : 0;
  } catch {}
  const backupKey = key + '.backup.' + new Date().toISOString();
  localStorage.setItem(backupKey, stored);
  localStorage.setItem(key, '[]');
  setTimeout(() => location.reload(), 250);
  return JSON.stringify({ backupKey, playedCount, reloading: true });
})()`;

const response = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('CDP recovery timed out')), 5000);
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
  throw new Error(response.result?.exceptionDetails?.text ?? 'CDP recovery returned no value');
}
process.stdout.write(`${value}\n`);
