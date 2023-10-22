import { Elysia, t } from 'elysia';
import { html } from '@elysiajs/html';
import { tw } from 'twind'; //TODO get twind working
import {
  getBlockHash,
  getBlockHashByHeight,
  getBlockHeight,
  getBlockTime,
  getContent,
} from './utils';

const app = new Elysia()
  .use(html())
  .get('/', ({ html }) => html(renderBaseHtml()))
  .get('/content/:inscriptionId', async ({ params }) => {
    const { inscriptionId } = params;
    console.log('inscriptionId', inscriptionId);

    if (inscriptionId) {
      const txId = inscriptionId.slice(0, -2);
      try {
        const { data, contentType } = await getContent(txId);
        const headers = new Headers();
        headers.append('Content-Type', contentType);
        headers.append(
          'Content-Security-Policy',
          "default-src 'self' 'unsafe-eval' 'unsafe-inline' data: blob:"
        );
        headers.append(
          'Content-Security-Policy',
          "default-src *:*/content/ *:*/blockheight *:*/blockhash *:*/blockhash/ *:*/blocktime 'unsafe-eval' 'unsafe-inline' data: blob:"
        );
        headers.append('Cache-Control', 'max-age=31536000, immutable');
        headers.append('Transfer-Encoding', 'chunked');
        return new Response(data, { headers });
      } catch (error) {
        console.error('Error fetching content:', error);
        return new Response('Error fetching content', { status: 500 });
      }
    }
    return new Response('Inscription not found', { status: 404 });
  })
  .get('/inscription/:inscriptionId', async ({ params, html }) => {
    const { inscriptionId } = params;
    return html(
      <BaseHtml>
        <div class="text-red-500">{inscriptionId}</div>
      </BaseHtml>
    );
  })
  .get('/blockheight', async () => {
    const blockHeight = await getBlockHeight();
    if (!blockHeight) {
      return new Response('Error fetching block height', { status: 500 });
    }
    return new Response(String(blockHeight), {
      headers: { 'Content-Type': 'text/plain' },
    });
  })
  .get('/blockhash', async () => {
    const blockhash = await getBlockHash();
    if (!blockhash) {
      return new Response('Error fetching block hash', { status: 500 });
    }
    return new Response(String(blockhash), {
      headers: { 'Content-Type': 'text/plain' },
    });
  })
  .get('/blockhash/:blockheight', async ({ params }) => {
    const blockHeight = params.blockheight;
    const blockhash = await getBlockHashByHeight(blockHeight);
    if (!blockhash) {
      return new Response('Error fetching block hash', { status: 500 });
    }
    return new Response(String(blockhash), {
      headers: { 'Content-Type': 'text/plain' },
    });
  })
  .get('/blocktime', async () => {
    const blockTime = await getBlockTime();
    if (!blockTime) {
      return new Response('Error fetching block time', { status: 500 });
    }
    return new Response(String(blockTime), {
      headers: { 'Content-Type': 'text/plain' },
    });
  })
  .listen(6969);

console.log(
  `🥱 Bord is running at http://${app.server?.hostname}:${app.server?.port}`
);

const BaseHtml = ({ children }: { children: JSX.Element }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <link rel="icon" href="/favicon.ico" type="image/x-icon" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Bord</title>
      <script src="https://unpkg.com/htmx.org@1.9.3"></script>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    {children}
  </html>
);

const renderBaseHtml = () => (
  <BaseHtml>
    <body class="flex bg-[#0f0f0f] text-red-500 w-full h-screen justify-center items-center">
      <form hx-post="/content" hx-swap="outerHTML">
        <input
          type="text"
          name="inscriptionId"
          placeholder="Enter inscription ID"
          class="rounded-lg px-4 py-2 border-2  border-[#f2a900]"
        ></input>
        <button type="submit">Submit</button>
        <i class="fa-solid fa-magnifying-glass"></i>
      </form>
    </body>
  </BaseHtml>
);
