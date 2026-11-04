/* Rede sempre: nenhuma mensagem, sessão, mídia ou página privada em Cache Storage. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.mode!=='navigate'||event.request.method!=='GET')return;
 event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>MenChat</title><body style="background:#0e1714;color:#e4eee7;font:16px system-ui;display:grid;place-content:center;text-align:center;min-height:90vh"><h1 style="color:#a4d689">MenChat</h1><p>Você está sem conexão.</p><p>Conecte-se à internet para acessar suas conversas.</p><button onclick="location.reload()" style="padding:16px;border:0;border-radius:12px">Tentar novamente</button></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
});
