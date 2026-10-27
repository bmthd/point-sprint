import { type SyncKind, type SyncRow, SyncRowSchema, syncKey } from "@workspaces/domain";
import * as v from "valibot";

// The keys of sync and what they lock, all made on this device. A random secret is the root: the
// rows' keys come from it, and the server keeps it only wrapped, by a key from the passkey's PRF
// and by a key from the recovery code. Neither the secret, the PRF's output nor the code is sent.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function fromBase64Url(text: string): Uint8Array {
  return Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (char) =>
    char.charCodeAt(0),
  );
}

/** What the passkey's PRF is asked to evaluate; the browser hashes it with its own prefix. */
export const PRF_SALT = encoder.encode("point-sprint sync prf v1");

export type SyncKeys = { encryptionKey: CryptoKey; idKey: CryptoKey };

/** The root of every sync key: 32 random bytes. */
export function generateMasterSecret(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

const hkdf = (material: Uint8Array) =>
  crypto.subtle.importKey("raw", material as BufferSource, "HKDF", false, [
    "deriveKey",
    "deriveBits",
  ]);

const hkdfParams = (info: string): HkdfParams => ({
  name: "HKDF",
  hash: "SHA-256",
  salt: new Uint8Array(),
  info: encoder.encode(info),
});

const aesKey = async (material: Uint8Array, info: string) =>
  crypto.subtle.deriveKey(
    hkdfParams(info),
    await hkdf(material),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

/** The keys the rows are locked with. Neither can be read out of this device. */
export async function deriveKeys(master: Uint8Array): Promise<SyncKeys> {
  const base = await hkdf(master);
  const [encryptionKey, idKey] = await Promise.all([
    crypto.subtle.deriveKey(
      hkdfParams("point-sprint sync encryption v1"),
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    ),
    crypto.subtle.deriveKey(
      hkdfParams("point-sprint sync id v1"),
      base,
      { name: "HMAC", hash: "SHA-256", length: 256 },
      false,
      ["sign"],
    ),
  ]);
  return { encryptionKey, idKey };
}

async function seal(key: CryptoKey, plain: Uint8Array, additionalData?: Uint8Array) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, ...(additionalData ? { additionalData } : {}) },
      key,
      plain as BufferSource,
    ),
  );
  const out = new Uint8Array(iv.length + sealed.length);
  out.set(iv);
  out.set(sealed, iv.length);
  return toBase64Url(out);
}

async function open(key: CryptoKey, text: string, additionalData?: Uint8Array) {
  const bytes = fromBase64Url(text);
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, 12), ...(additionalData ? { additionalData } : {}) },
      key,
      bytes.slice(12),
    ),
  );
}

export type WrapKind = "prf" | "recovery";

/** The secret, locked with a key made from the PRF's output or the recovery code. */
export async function wrapSecret(
  master: Uint8Array,
  keyMaterial: Uint8Array,
  kind: WrapKind,
): Promise<string> {
  return seal(await aesKey(keyMaterial, `point-sprint sync wrap ${kind} v1`), master);
}

/**
 * The secret back, or `undefined` when `keyMaterial` is not the one it was wrapped with: a wrong
 * code, or a PRF that gave another output than when it was wrapped.
 */
export async function unwrapSecret(
  wrapped: string,
  keyMaterial: Uint8Array,
  kind: WrapKind,
): Promise<Uint8Array | undefined> {
  try {
    return await open(await aesKey(keyMaterial, `point-sprint sync wrap ${kind} v1`), wrapped);
  } catch {
    return undefined;
  }
}

/** The id the server knows a row by, which tells it nothing of the row's kind or id. */
export async function recordId(idKey: CryptoKey, kind: SyncKind, id: string): Promise<string> {
  const mac = await crypto.subtle.sign("HMAC", idKey, encoder.encode(syncKey(kind, id)));
  return toBase64Url(new Uint8Array(mac));
}

/** A row as the server keeps it: what it may read, and the rest sealed. */
export type RemoteRecord = {
  recordId: string;
  updatedAt: string;
  version: number;
  deleted: boolean;
  body: string;
};

/** The fields the server reads are sealed in too, so that it cannot change them unnoticed. */
const associated = (record: Omit<RemoteRecord, "body">) =>
  encoder.encode(
    `${record.recordId}|${record.version}|${record.updatedAt}|${record.deleted ? 1 : 0}`,
  );

export async function encryptRow(
  keys: SyncKeys,
  row: SyncRow,
  version: number,
): Promise<RemoteRecord> {
  const header = {
    recordId: await recordId(keys.idKey, row.kind, row.id),
    updatedAt: row.updatedAt,
    version,
    deleted: row.deleted,
  };
  const plain = row.deleted
    ? { kind: row.kind, id: row.id }
    : { kind: row.kind, id: row.id, value: row.value };
  return {
    ...header,
    body: await seal(keys.encryptionKey, encoder.encode(JSON.stringify(plain)), associated(header)),
  };
}

const PlainSchema = v.object({
  kind: v.picklist(["plan", "order", "shop", "profile", "spuMonth"]),
  id: v.string(),
  value: v.optional(v.unknown()),
});

/**
 * The row in a record, with the data version it was written at. Throws when the record was not
 * sealed with these keys or was changed: its header, or a body moved from another record.
 */
export async function decryptRecord(
  keys: SyncKeys,
  record: RemoteRecord,
): Promise<{ row: SyncRow; version: number }> {
  const plain = v.parse(
    PlainSchema,
    JSON.parse(decoder.decode(await open(keys.encryptionKey, record.body, associated(record)))),
  );
  if ((await recordId(keys.idKey, plain.kind, plain.id)) !== record.recordId) {
    throw new Error("the record's id does not match its row");
  }
  const row = v.parse(SyncRowSchema, {
    kind: plain.kind,
    id: plain.id,
    updatedAt: record.updatedAt,
    deleted: record.deleted,
    ...(record.deleted ? {} : { value: plain.value }),
  });
  return { row, version: record.version };
}

// Crockford's Base32: no I, L, O or U, so that the code reads aloud and copies by hand.
// cspell:disable-next-line
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_BYTES = 16;
const CODE_LENGTH = Math.ceil((CODE_BYTES * 8) / 5);

/** 128 random bits as 26 characters in groups of 4: `K7QM-3XRP-…-XX`. */
export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_BYTES));
  let bits = 0;
  let buffer = 0;
  let text = "";
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      text += ALPHABET[(buffer >> bits) & 31];
    }
  }
  if (bits > 0) text += ALPHABET[(buffer << (5 - bits)) & 31];
  return text.match(/.{1,4}/g)?.join("-") ?? text;
}

/**
 * The bytes of a recovery code as the user typed or pasted it: any case, with spaces or hyphens,
 * O for 0 and I or L for 1. `undefined` when it is not 26 such characters.
 */
export function parseRecoveryCode(input: string): Uint8Array | undefined {
  const text = input.toUpperCase().replace(/[\s-]/g, "").replaceAll("O", "0").replace(/[IL]/g, "1");
  if (text.length !== CODE_LENGTH) return undefined;
  const bytes = new Uint8Array(CODE_BYTES);
  let bits = 0;
  let buffer = 0;
  let index = 0;
  for (const char of text) {
    const value = ALPHABET.indexOf(char);
    if (value === -1) return undefined;
    buffer = ((buffer << 5) | value) & 0xfff;
    bits += 5;
    if (bits >= 8 && index < CODE_BYTES) {
      bits -= 8;
      bytes[index++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}

/** What the server checks a recovery code by: it cannot make the code or its wrapping key from it. */
export async function recoveryVerifier(code: Uint8Array): Promise<string> {
  const bits = await crypto.subtle.deriveBits(
    hkdfParams("point-sprint sync recovery login v1"),
    await hkdf(code),
    256,
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", bits)));
}

/** Keeps the root available only to a device that already has the data key. */
export async function sealMaster(key: CryptoKey, master: Uint8Array): Promise<string> {
  return seal(key, master, encoder.encode("point-sprint local master v1"));
}

export async function openMaster(key: CryptoKey, wrapped: string): Promise<Uint8Array> {
  return open(key, wrapped, encoder.encode("point-sprint local master v1"));
}
