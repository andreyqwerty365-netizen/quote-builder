import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from '../server.js';

test('HTTP: страница и модули локальны; приватные файлы не выдаются', async t => {
  const server=createServer();
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const page=await fetch(base);
  assert.equal(page.status,200);
  assert.match(await page.text(),/<html lang="ru">/);
  assert.match(page.headers.get('content-security-policy'),/connect-src 'none'/);
  for(const asset of ['/styles.css','/src/quote.js','/src/app.js','/favicon.svg']) assert.equal((await fetch(base+asset)).status,200);
  for(const path of ['/package.json','/docs/PROJECT.md','/../server.js','/.agent-base/project.json','/%2e%2e/server.js']) assert.equal((await fetch(base+path)).status,404);
  assert.equal((await fetch(base,{method:'POST'})).status,405);
  const head=await fetch(base,{method:'HEAD'});
  assert.equal(head.status,200);
  assert.equal(await head.text(),'');
});
