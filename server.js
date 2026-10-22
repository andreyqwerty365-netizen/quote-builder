import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const assets = new Map([
  ['/', ['index.html','text/html; charset=utf-8']],
  ['/index.html', ['index.html','text/html; charset=utf-8']],
  ['/styles.css', ['styles.css','text/css; charset=utf-8']],
  ['/src/app.js', ['src/app.js','text/javascript; charset=utf-8']],
  ['/src/quote.js', ['src/quote.js','text/javascript; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg','image/svg+xml']]
]);

export function createServer() {
  return http.createServer(async (req,res) => {
    const headers = {
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer', 'Cache-Control':'no-store'
    };
    if (!['GET','HEAD'].includes(req.method)) {
      res.writeHead(405,{...headers,Allow:'GET, HEAD'});res.end('Method not allowed');return;
    }
    let pathname;
    try { pathname=new URL(req.url,'http://127.0.0.1').pathname; } catch {res.writeHead(400,headers);res.end();return;}
    const asset=assets.get(pathname);
    if (!asset) {res.writeHead(404,headers);res.end('Not found');return;}
    try {
      const body=await readFile(new URL(asset[0],import.meta.url));
      res.writeHead(200,{...headers,'Content-Type':asset[1],'Content-Length':body.length});
      res.end(req.method==='HEAD'?undefined:body);
    } catch {res.writeHead(500,headers);res.end('Could not read asset');}
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const server=createServer();
  server.on('error',error=>{console.error(`Не удалось запустить сервер: ${error.message}`);process.exitCode=1;});
  server.listen(4174,'127.0.0.1',()=>console.log('Quote Builder: http://127.0.0.1:4174 (Ctrl+C для остановки)'));
}
