'use strict';

/*
 * Lokální server pro vývoj: node scripts/serve.js [port]  (výchozí port 8765)
 *
 * Na rozdíl od `python3 -m http.server`:
 *   – posílá Cache-Control: no-store,
 *   – v HTML přidává k lokálním souborům (CSS, JS, SVG…) ?v=<čas poslední změny souboru>. Prohlížeč, který
 *     má starší skript uložený z dřívějška (třeba po spuštění jiného serveru), si tak díky jiné adrese
 *     vždy vyžádá aktuální. Bez toho se po obnovení stránky může načíst nové HTML se starým skriptem
 *     (Safari při běžném obnovení znovu načte jen hlavní HTML).
 *   – vypisuje každý požadavek, takže je vidět, co prohlížeč opravdu načítá.
 * Poslouchá jen na localhostu, na IPv4 (127.0.0.1) i IPv6 (::1). Prohlížeče zkoušejí `localhost` nejdřív
 * na IPv6, takže kdyby tam už běžel jiný server (třeba zapomenutý python), odpovídal by on a ten tvůj
 * by se vůbec nezavolal. Proto se při obsazeném portu na kterékoli adrese server raději nespustí.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8'
};

const LOCAL_ASSET = /((?:href|src)=")([^":?#]+\.(?:css|js|svg|png|webp|ico))"/g;

// K lokálním souborům v HTML přidá ?v=<mtime>. Soubory, které neexistují, nechá být.
function stampAssets(html, htmlFile, base) {
  return html.replace(LOCAL_ASSET, (match, prefix, rel) => {
    const target = path.resolve(path.dirname(htmlFile), rel);
    if (target !== base && !target.startsWith(base + path.sep)) return match;
    try {
      return `${prefix}${rel}?v=${Math.round(fs.statSync(target).mtimeMs)}"`;
    } catch (e) {
      return match;
    }
  });
}

function createServer(root, options = {}) {
  const base = path.resolve(root);
  return http.createServer((req, res) => {
    const send = (status, body, type) => {
      res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(body);
    };
    if (options.log) {
      const started = Date.now();
      res.on('finish', () => options.log(`${res.statusCode} ${req.method} ${req.url} (${Date.now() - started} ms)`));
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch (e) {
      return send(400, 'Neplatná adresa');
    }

    let file = path.join(base, pathname);
    if (file !== base && !file.startsWith(base + path.sep)) return send(403, 'Mimo složku webu');

    fs.stat(file, (err, stat) => {
      if (!err && stat.isDirectory()) {
        // Složka bez lomítka na konci: relativní adresy v ní by se jinak počítaly od nadřazené složky.
        if (!pathname.endsWith('/')) {
          res.writeHead(301, { Location: pathname + '/', 'Cache-Control': 'no-store' });
          return res.end();
        }
        file = path.join(file, 'index.html');
      }
      fs.readFile(file, (readErr, data) => {
        if (readErr) return send(404, 'Nenalezeno');
        if (path.extname(file) === '.html') data = stampAssets(data.toString('utf8'), file, base);
        send(200, data, TYPES[path.extname(file)] || 'application/octet-stream');
      });
    });
  });
}

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

// Spustí server na 127.0.0.1 a ::1 se stejným portem (port 0 = volný port). Bez IPv6 poběží jen na IPv4.
// Když je port na některé adrese obsazený, vrátí chybu a nic nechá otevřené.
async function startLocal(root, port, options) {
  const servers = [createServer(root, options)];
  const close = () => servers.forEach((s) => s.close());
  try {
    const actual = await listen(servers[0], port, '127.0.0.1');
    const v6 = createServer(root, options);
    try {
      await listen(v6, actual, '::1');
      servers.push(v6);
    } catch (e) {
      if (e.code !== 'EADDRNOTAVAIL' && e.code !== 'EAFNOSUPPORT') throw e;
    }
    return { port: actual, close };
  } catch (e) {
    close();
    throw e;
  }
}

module.exports = { createServer, stampAssets, startLocal };

if (require.main === module) {
  const port = Number(process.argv[2]) || 8765;
  startLocal(path.join(__dirname, '..'), port, { log: (line) => console.log(line) }).then(
    (s) => console.log(`http://localhost:${s.port}/  (bez cache, Ctrl+C ukončí)`),
    (e) => {
      console.error(e.code === 'EADDRINUSE'
        ? `Port ${port} už používá jiný proces. Zjistíš ho příkazem: lsof -nP -iTCP:${port} -sTCP:LISTEN`
        : e.message);
      process.exit(1);
    }
  );
}
