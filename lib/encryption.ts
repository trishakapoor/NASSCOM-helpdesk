// lib/encryption.ts
const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT = "captain-obvious-helpdesk-v1";

let cachedKey: CryptoKey | null = null;

async function getDerivedKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error("ENCRYPTION_SECRET is missing from .env.local!");
  }

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  cachedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(SALT),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );

  return cachedKey;
}

export async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;
  const key = await getDerivedKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const ivBase64 = Buffer.from(iv).toString("base64");
  const cipherBase64 = Buffer.from(cipherBuffer).toString("base64");
  return `${ivBase64}:${cipherBase64}`;
}

export async function decrypt(ciphertext: string): Promise<string> {
  if (!ciphertext || !ciphertext.includes(":")) return ciphertext;
  const key = await getDerivedKey();
  const [ivBase64, cipherBase64] = ciphertext.split(":");
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: Buffer.from(ivBase64, "base64") },
    key,
    Buffer.from(cipherBase64, "base64")
  );
  return new TextDecoder().decode(decryptedBuffer);
}

export async function encryptFields<T extends Record<string, unknown>>(
  obj: T,
  fields: string[]
): Promise<T> {
  const result = { ...obj };
  await Promise.all(
    fields.map(async (fieldName) => {
      if (result[fieldName] && typeof result[fieldName] === "string") {
        (result as Record<string, unknown>)[fieldName] = await encrypt(
          result[fieldName] as string
        );
      }
    })
  );
  return result;
}

export async function decryptFields<T extends Record<string, unknown>>(
  obj: T,
  fields: string[]
): Promise<T> {
  const result = { ...obj };
  await Promise.all(
    fields.map(async (fieldName) => {
      if (result[fieldName] && typeof result[fieldName] === "string") {
        try {
          (result as Record<string, unknown>)[fieldName] = await decrypt(
            result[fieldName] as string
          );
        } catch {
          console.warn(
            `[encryption] Could not decrypt field "${fieldName}" — may be legacy unencrypted data`
          );
        }
      }
    })
  );
  return result;
}