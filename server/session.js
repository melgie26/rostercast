import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
export class Sessions {
  constructor({ key, production, origin }, now = () => Date.now()) {
    this.key = Buffer.from(key, 'hex'); this.production = production; this.origin = origin; this.now = now;
    this.name = production ? '__Host-rostercast' : 'rostercast_dev';
  }
  seal(session) {
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(this.origin));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
  }
  read(header = '') {
    try {
      const cookie = header.split(';').map(s => s.trim()).find(s => s.startsWith(`${this.name}=`));
      if (!cookie) return null;
      const bytes = Buffer.from(cookie.slice(this.name.length + 1), 'base64url');
      const decipher = createDecipheriv('aes-256-gcm', this.key, bytes.subarray(0,12));
      decipher.setAAD(Buffer.from(this.origin)); decipher.setAuthTag(bytes.subarray(12,28));
      const session = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString());
      if (typeof session.access_token !== 'string' || typeof session.expires_at !== 'number' || session.expires_at <= this.now()/1000) return null;
      return session;
    } catch { return null; }
  }
  cookie(session) {
    const lifetime = session ? Math.max(0, Math.min(3600, Math.floor(session.expires_at-this.now()/1000))) : 0;
    return `${this.name}=${session ? this.seal(session) : ''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${lifetime}${this.production ? '; Secure' : ''}`;
  }
}
