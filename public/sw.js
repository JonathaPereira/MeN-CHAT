/* Rede sempre: nenhuma mensagem, sessão, mídia ou página privada em Cache Storage. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.mode!=='navigate'||event.request.method!=='GET')return;
 event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>MenChat</title><body style="background:#0e1714;color:#e4eee7;font:16px system-ui;display:grid;place-content:center;text-align:center;min-height:90vh"><h1 style="color:#a4d689">MenChat</h1><p>Você está sem conexão.</p><p>Conecte-se à internet para acessar suas conversas.</p><button onclick="location.reload()" style="padding:16px;border:0;border-radius:12px">Tentar novamente</button></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
});

// Push never includes message text, sender names, signed media URLs or tokens.
self.addEventListener('push', event => {
 event.waitUntil((async () => {
  const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
  if (windows.some(client => client.visibilityState === 'visible' && client.focused)) return;
  let tag = 'menchat-message';
  try { const data = event.data?.json(); if (/^[0-9a-f-]{36}$/i.test(data?.tag)) tag=data.tag; } catch {}
  await self.registration.showNotification('MenChat', {
   body:'Você tem uma nova mensagem.',icon:'/app/icon-192.png',badge:'/app/icon-192.png',
   tag,data:{url:'/conta/chat'},renotify:false,
  });
 })());
});
self.addEventListener('notificationclick', event => {
 event.notification.close();
 event.waitUntil((async () => {
  const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const client = windows.find(client => new URL(client.url).origin === self.location.origin);
  if (client) { await client.navigate('/conta/chat'); await client.focus(); }
  else await self.clients.openWindow('/conta/chat');
 })());
});
