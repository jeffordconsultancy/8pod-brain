import CryptoJS from 'crypto-js';

const KEY = process.env.ENCRYPTION_KEY || 'default-dev-key';

export function encryptToken(token: string): string {
  return CryptoJS.AES.encrypt(token, KEY).toString();
}

export function decryptToken(encrypted: string): string {
  return CryptoJS.AES.decrypt(encrypted, KEY).toString(CryptoJS.enc.Utf8);
}
