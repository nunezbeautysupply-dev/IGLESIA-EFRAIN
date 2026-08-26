// ═══════════════════════════════════════════════════════════════
//  IGLESIA EFRAIN PARA DIOS — guardian de la app
//  Guarda una copia de la APP en el telefono para que abra sin
//  internet. OJO: aqui NUNCA se guarda ningun libro. Los libros
//  viven en el almacen privado del navegador y no pasan por aqui.
//
//  CAMBIO DEL 25 AGO 2026 — por que la app iba una version atras:
//  antes TODO se servia primero de la copia guardada y la version
//  nueva se bajaba por detras "para la proxima vez". Por eso habia
//  que abrir la app dos veces para ver un cambio.
//  Ahora el index.html (la app en si) pregunta a internet PRIMERO,
//  con un tope de 2 segundos. Si no hay señal o tarda mas, usa la
//  copia guardada, igual que siempre. Lo demas (iconos, manifest)
//  sigue saliendo de la copia, porque no cambia nunca.
// ═══════════════════════════════════════════════════════════════
var CACHE = 'efd-v9';
var BASE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

/* cuanto se espera a internet antes de rendirse y usar la copia */
var ESPERA_APP  = 2000;   // para la app: poco, para que abra rapido
var ESPERA_OTRO = 4000;   // para lo demas

function sana(r){
  return !!r && !r.redirected && r.type !== 'opaque' && r.type !== 'opaqueredirect' && r.status === 200;
}
function redConLimite(req, ms){
  return new Promise(function(ok, mal){
    var listo = false;
    var reloj = setTimeout(function(){ if(!listo){ listo = true; mal(new Error('lenta')); } }, ms);
    fetch(req).then(function(r){ if(listo) return; listo = true; clearTimeout(reloj); ok(r); })
              .catch(function(e){ if(listo) return; listo = true; clearTimeout(reloj); mal(e); });
  });
}

/* ¿Esta peticion es la APP en si? Esas son las que hay que traer
   frescas: abrir la app, o pedir el index.html directamente. */
function esLaApp(req, u){
  if(req.mode === 'navigate') return true;
  var p = u.pathname;
  return /(^|\/)(index\.html)?$/.test(p);
}

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(BASE.map(function(u){
      return fetch(u, {cache:'reload'}).then(function(r){
        if(sana(r)) return c.put(u, r.clone());
      }).catch(function(){});
    }));
  }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ns){
    return Promise.all(ns.map(function(n){ if(n !== CACHE) return caches.delete(n); }));
  }).then(function(){ return self.clients.claim(); }));
});

/* Si la app pide saltar a la version nueva (el boton del letrero) */
self.addEventListener('message', function(e){
  if(e.data && e.data.tipo === 'saltar') self.skipWaiting();
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var u; try{ u = new URL(req.url); }catch(err){ return; }
  if(u.origin !== self.location.origin) return;

  /* ── LA APP: internet primero, copia de respaldo ────────────── */
  if(esLaApp(req, u)){
    e.respondWith(
      redConLimite(req, ESPERA_APP).then(function(r){
        if(sana(r)){
          var copia = r.clone();
          e.waitUntil(caches.open(CACHE).then(function(c){
            c.put('./index.html', copia);
            return c.put('./', copia.clone());
          }).catch(function(){}));
          return r;
        }
        throw new Error('respuesta rara');
      }).catch(function(){
        /* sin señal, o tardo mas de 2 segundos: la copia guardada */
        return caches.match('./index.html').then(function(hay){
          return hay || caches.match('./').then(function(h2){
            return h2 || new Response('Sin conexión y sin copia guardada.',
              { status:503, headers:{ 'Content-Type':'text/plain; charset=utf-8' } });
          });
        });
      })
    );
    return;
  }

  /* ── TODO LO DEMAS: copia primero (iconos, manifest) ─────────── */
  e.respondWith(caches.match(req).then(function(hay){
    if(hay && sana(hay)){
      e.waitUntil(redConLimite(req, 8000).then(function(r){
        if(sana(r)) return caches.open(CACHE).then(function(c){ return c.put(req, r.clone()); });
      }).catch(function(){}));
      return hay;
    }
    if(hay) caches.open(CACHE).then(function(c){ c.delete(req); });
    return redConLimite(req, ESPERA_OTRO).then(function(r){
      if(sana(r)) caches.open(CACHE).then(function(c){ c.put(req, r.clone()); });
      return r;
    }).catch(function(){
      if(req.mode === 'navigate') return caches.match('./index.html');
      return new Response('', {status:503});
    });
  }));
});
