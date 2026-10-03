/** Run deliberately in your secure local environment; never commit the output. */
const {createECDH}=require('node:crypto');
const key=createECDH('prime256v1');key.generateKeys();
console.error('Store the private key in server-only deployment secrets. Do not paste it into source, logs or the integration ZIP.');
console.log('PWA_PUSH_VAPID_PUBLIC_KEY='+key.getPublicKey().toString('base64url'));
console.log('PWA_PUSH_VAPID_PRIVATE_KEY='+key.getPrivateKey().toString('base64url'));
