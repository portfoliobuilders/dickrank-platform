import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { initChatSocket } from './src/lib/chat-socket';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT || 3000);
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const url = req.url || '';
    if (url.startsWith('/api/socket/io')) return;
    handle(req, res, parse(url, true));
  });
  initChatSocket(server);
  server.listen(port, () => {
    console.log(`Ready on http://localhost:${port}`);
  });
});
