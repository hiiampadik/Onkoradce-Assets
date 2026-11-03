'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
const { createServer, stampAssets, startLocal } = require('../scripts/serve.js');

// Spustí server na volném portu. V prostředí, které otevření portu zakazuje (EPERM), se test přeskočí.
async function withServer(t, run) {
  const server = createServer(path.join(__dirname, '..'));
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
  } catch (e) {
    if (e.code === 'EPERM') return t.skip('prostředí nepovoluje otevřít port');
    throw e;
  }
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

test('lokální server: soubory se posílají s Cache-Control: no-store a správným typem', (t) => withServer(t, async (url) => {
  for (const [file, type] of [['/', 'text/html'], ['/app.js', 'text/javascript'], ['/site.css', 'text/css'], ['/animace/', 'text/html']]) {
    const res = await fetch(url + file);
    assert.equal(res.status, 200, file);
    assert.equal(res.headers.get('cache-control'), 'no-store', file);
    assert.ok(res.headers.get('content-type').startsWith(type), file);
  }
}));

test('lokální server: složka bez lomítka se přesměruje, neexistující soubor je 404 a ven ze složky se nedá', (t) => withServer(t, async (url) => {
  const redirect = await fetch(url + '/animace', { redirect: 'manual' });
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get('location'), '/animace/');
  assert.equal((await fetch(url + '/neexistuje.js')).status, 404);
  assert.equal((await fetch(url + '/..%2f..%2f..%2fetc/hosts')).status, 403, 'zakódovaná lomítka nesmí vyvést ze složky');
  assert.equal((await fetch(url + '/%E0%A4%A')).status, 400);
}));

test('lokální server: HTML dostane u lokálních souborů ?v=<čas změny>, odkazy mimo web a neexistující soubory beze změny', (t) => withServer(t, async (url) => {
  const html = await (await fetch(url + '/')).text();
  const root = path.join(__dirname, '..');
  const mtime = (file) => Math.round(fs.statSync(path.join(root, file)).mtimeMs);
  assert.ok(html.includes(`src="app.js?v=${mtime('app.js')}"`));
  assert.ok(html.includes(`href="site.css?v=${mtime('site.css')}"`));
  assert.ok(html.includes(`src="shape.js?v=${mtime('shape.js')}"`));
  const sub = await (await fetch(url + '/animace/')).text();
  assert.ok(sub.includes(`href="../site.css?v=${mtime('site.css')}"`), 'cesta ../ se počítá od složky stránky');
}));

test('stampAssets: nechá být adresy mimo web, neexistující soubory i odkazy na stránky', () => {
  const root = path.join(__dirname, '..');
  const html = '<a href="https://example.com/x.js"></a><script src="neexistuje.js"></script><a href="animace/"></a><script src="../../mimo.js"></script><script src="app.js"></script>';
  const out = stampAssets(html, path.join(root, 'index.html'), root);
  assert.ok(out.includes('href="https://example.com/x.js"'));
  assert.ok(out.includes('src="neexistuje.js"'));
  assert.ok(out.includes('href="animace/"'));
  assert.ok(out.includes('src="../../mimo.js"'));
  assert.match(out, /src="app\.js\?v=\d+"/);
});

test('startLocal: server odpovídá na 127.0.0.1 i na ::1 (kam míří localhost v prohlížeči)', async (t) => {
  let s;
  try {
    s = await startLocal(path.join(__dirname, '..'), 0);
  } catch (e) {
    if (e.code === 'EPERM') return t.skip('prostředí nepovoluje otevřít port');
    throw e;
  }
  try {
    assert.equal((await fetch(`http://127.0.0.1:${s.port}/app.js`)).status, 200);
    const v6 = await fetch(`http://[::1]:${s.port}/app.js`).catch(() => null);
    if (v6) assert.equal(v6.status, 200, 'IPv6');
  } finally {
    s.close();
  }
});

test('startLocal: když je port na ::1 obsazený jiným procesem, server se nespustí a nezůstane po něm nic otevřeného', async (t) => {
  const blocker = net.createServer();
  try {
    await new Promise((resolve, reject) => { blocker.once('error', reject); blocker.listen(0, '::1', resolve); });
  } catch (e) {
    return t.skip('prostředí nepovoluje port nebo IPv6 (' + e.code + ')');
  }
  try {
    const port = blocker.address().port;
    await assert.rejects(startLocal(path.join(__dirname, '..'), port), { code: 'EADDRINUSE' });
    // IPv4 část se musela zase zavřít, port jde hned znovu otevřít
    const again = net.createServer();
    await new Promise((resolve, reject) => { again.once('error', reject); again.listen(port, '127.0.0.1', resolve); });
    again.close();
  } finally {
    blocker.close();
  }
});
