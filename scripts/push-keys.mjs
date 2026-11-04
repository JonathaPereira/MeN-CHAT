import webpush from "web-push";
import { randomBytes } from "node:crypto";
const keys = webpush.generateVAPIDKeys();
console.log("Copie estas variáveis para a Vercel. Guarde a chave privada e o segredo fora do repositório; não os envie em conversas.");
console.log(`MENCHAT_VAPID_PUBLIC_KEY=${keys.publicKey}\nMENCHAT_VAPID_PRIVATE_KEY=${keys.privateKey}\nMENCHAT_PUSH_CRON_SECRET=${randomBytes(32).toString("hex")}\nMENCHAT_VAPID_SUBJECT=https://men-chat.vercel.app`);
