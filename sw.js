// ═══════════════════════════════════════════════════════════════
//  IGLESIA EFRAIN PARA DIOS — guardian de la app
//  Guarda una copia de la APP en el telefono para que abra sin
//  internet. OJO: aqui NUNCA se guarda ningun libro. Los libros
//  viven en el almacen privado del navegador y no pasan por aqui.
// ═══════════════════════════════════════════════════════════════
var CACHE = 'efd-v6';
var BASE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

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
self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var u; try{ u = new URL(req.url); }catch(err){ return; }
  if(u.origin !== self.location.origin) return;
  e.respondWith(caches.match(req).then(function(hay){
    if(hay && sana(hay)){
      e.waitUntil(redConLimite(req, 8000).then(function(r){
        if(sana(r)) return caches.open(CACHE).then(function(c){ return c.put(req, r.clone()); });
      }).catch(function(){}));
      return hay;
    }
    if(hay) caches.open(CACHE).then(function(c){ c.delete(req); });
    return redConLimite(req, 4000).then(function(r){
      if(sana(r)) caches.open(CACHE).then(function(c){ c.put(req, r.clone()); });
      return r;
    }).catch(function(){
      if(req.mode === 'navigate') return caches.match('./index.html');
      return new Response('', {status:503});
    });
  }));
});
