import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SALT_BYTES = 16;

/** Hash a password using Node's built-in scrypt KDF. Persist only this encoded value. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = (await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS)) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

/** Returns false for malformed/unsupported hashes as well as incorrect passwords. */
export async function verifyPassword(password: string, encoded: string | null | undefined): Promise<boolean> {
  if (!encoded) return false;
  const [algorithm, saltText, hashText, extra] = encoded.split("$");
  if (algorithm !== "scrypt" || !saltText || !hashText || extra !== undefined) return false;

  try {
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(hashText, "base64url");
    if (salt.length !== SALT_BYTES || expected.length !== KEY_LENGTH) return false;
    const actual = (await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS)) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
