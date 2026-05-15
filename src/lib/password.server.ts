// Hash de senha com PBKDF2 via Web Crypto (sem dependências nativas).
// Funciona tanto em Node quanto em Workers.

const ITERATIONS = 100_000;
const KEY_LEN = 32;

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBuf(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function derive(password: string, salt: Uint8Array): Promise<string> {
  const pwBytes = new TextEncoder().encode(password);
  const key = await crypto.subtle.importKey(
    "raw",
    pwBytes.buffer.slice(pwBytes.byteOffset, pwBytes.byteOffset + pwBytes.byteLength),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const saltBuf = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuf, iterations: ITERATIONS },
    key,
    KEY_LEN * 8,
  );
  return bufToB64(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt);
  return `pbkdf2$${ITERATIONS}$${bufToB64(salt.buffer)}$${hash}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const salt = b64ToBuf(parts[2]);
  const expected = parts[3];
  const got = await derive(password, salt);
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++)
    diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
