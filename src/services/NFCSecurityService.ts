// src/services/NFCSecurityService.ts — NTAG21x write protection ("tag lock").
//
// The organisation's lock code becomes a 4-byte NTAG password (PWD) and a
// 2-byte acknowledge (PACK). Both are computed by the server; this module only
// ever handles the bytes it is given and never logs them.
//
// Locking sets AUTH0 to the first user page (0x04) and clears ACCESS.PROT, so
// tags stay readable by anyone but rewriting, erasing or re-locking them needs
// the password. Everything here talks raw NFC-A commands through a small TagIO
// interface so the same code runs on Android (NfcA.transceive) and iOS
// (NFCMiFareTag.sendMiFareCommand), and so it can be unit-tested against a
// fake tag.
//
// NTAG21x drops back to IDLE after any NAK (failed PWD_AUTH, a command the chip
// doesn't support, a read of a read-protected page). The next command then
// fails until the tag is re-selected, so every NAK is followed by
// io.reselect().

export const CMD = {
  GET_VERSION: 0x60,
  READ: 0x30,
  WRITE: 0xa2,
  PWD_AUTH: 0x1b,
} as const;

/** First user memory page on every NFC Forum Type 2 tag. */
export const FIRST_USER_PAGE = 0x04;
/** AUTH0 value that disables password protection. */
export const AUTH0_DISABLED = 0xff;
/** ACCESS byte bits (first byte of CFG1). */
export const ACCESS_PROT = 0x80; // 1 = reads need the password too
export const ACCESS_CFGLCK = 0x40; // 1 = config pages permanently locked

export interface NtagModel {
  name: 'NTAG210' | 'NTAG212' | 'NTAG213' | 'NTAG215' | 'NTAG216';
  /** Last page of user memory (NDEF area). */
  userEnd: number;
  /** CFG0: MIRROR, RFUI, MIRROR_PAGE, AUTH0. CFG1 (ACCESS) = cfg0 + 1. */
  cfg0: number;
  /** PWD = cfg0 + 2, PACK = cfg0 + 3. */
}

// Indexed by the GET_VERSION storage-size byte. All are NTAG21x (product
// type 0x04). The NTAG I2C family reuses some storage-size values with a
// completely different memory map, so detection also checks the subtype.
const MODELS_BY_STORAGE: Record<number, NtagModel> = {
  0x0b: { name: 'NTAG210', userEnd: 0x0f, cfg0: 0x10 },
  0x0e: { name: 'NTAG212', userEnd: 0x23, cfg0: 0x25 },
  0x0f: { name: 'NTAG213', userEnd: 0x27, cfg0: 0x29 },
  0x11: { name: 'NTAG215', userEnd: 0x81, cfg0: 0x83 },
  0x13: { name: 'NTAG216', userEnd: 0xe1, cfg0: 0xe3 },
};

export const cfg1Page = (m: NtagModel) => m.cfg0 + 1;
export const pwdPage = (m: NtagModel) => m.cfg0 + 2;
export const packPage = (m: NtagModel) => m.cfg0 + 3;

export interface TagKey {
  /** 4 bytes written to the PWD page and sent with PWD_AUTH. */
  password: number[];
  /** 2 bytes written to the PACK page and expected back from PWD_AUTH. */
  pack: number[];
}

export interface TagLockKeys {
  /** Org lock is on: tags are (re-)locked with `current` after every write. */
  enabled: boolean;
  current: TagKey | null;
  /** The code before the last change (or before the lock was turned off). */
  previous: TagKey | null;
}

/** The raw NFC-A link to the tag in the current session. */
export interface TagIO {
  transceive(command: number[]): Promise<number[]>;
  /** Re-select the tag after a NAK (clears any authentication). */
  reselect(): Promise<void>;
}

export type TagLockErrorCode =
  | 'wrong-code'
  | 'unsupported'
  | 'config-locked'
  | 'capacity'
  | 'not-ndef'
  | 'read-only'
  | 'verify-failed';

const ERROR_MESSAGES: Record<TagLockErrorCode, string> = {
  'wrong-code': 'This tag is locked with a different code',
  unsupported: "This tag type can't be locked. Use an NTAG213, NTAG215 or NTAG216 tag.",
  'config-locked': "This tag's settings are permanently locked, so it can't be password protected.",
  capacity: 'The data is too large for this tag.',
  'not-ndef': "This tag isn't NDEF formatted.",
  'read-only': 'This tag is read-only and cannot be written to.',
  'verify-failed': "The tag didn't accept the lock settings. Hold the tag still and try again.",
};

export class TagLockError extends Error {
  code: TagLockErrorCode;
  constructor(code: TagLockErrorCode, message?: string) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = 'TagLockError';
    this.code = code;
  }
}

/** A NAK (or no answer) from the tag. The tag is now IDLE and needs reselecting. */
export class TagNakError extends Error {
  constructor(command: number) {
    super(`Tag rejected command 0x${command.toString(16).padStart(2, '0')}`);
    this.name = 'TagNakError';
  }
}

// ── bytes ────────────────────────────────────────────────────────────────

/** "000004D2" → [0x00, 0x00, 0x04, 0xD2]. Throws on bad input. */
export function hexToBytes(hex: string, expectedLength: number): number[] {
  const clean = (hex || '').trim();
  if (clean.length !== expectedLength * 2 || !/^[0-9a-fA-F]+$/.test(clean)) {
    throw new Error(`Expected ${expectedLength} bytes of hex`);
  }
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return out;
}

/** Server password_hex/pack_hex → TagKey, or null if either is missing. */
export function toTagKey(passwordHex?: string | null, packHex?: string | null): TagKey | null {
  if (!passwordHex || !packHex) return null;
  return { password: hexToBytes(passwordHex, 4), pack: hexToBytes(packHex, 2) };
}

const sameBytes = (a: number[] | undefined, b: number[] | undefined) =>
  !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);

export const sameKey = (a: TagKey | null, b: TagKey | null) =>
  !!a && !!b && sameBytes(a.password, b.password) && sameBytes(a.pack, b.pack);

/** True when there is any code to authenticate with or lock to. */
export function hasLockKeys(keys: TagLockKeys | null | undefined): keys is TagLockKeys {
  return !!keys && (!!keys.current || !!keys.previous);
}

// ── commands ─────────────────────────────────────────────────────────────

async function send(io: TagIO, command: number[]): Promise<number[]> {
  let response: number[];
  try {
    response = await io.transceive(command);
  } catch {
    // Android throws on a NAK/no answer; iOS reports a tag response error.
    throw new TagNakError(command[0]);
  }
  return Array.from(response ?? []);
}

/** A 4-bit NAK shows up as a single byte whose low nibble isn't 0xA (ACK). */
function isNak(response: number[]): boolean {
  return response.length === 1 && (response[0] & 0x0f) !== 0x0a;
}

/** READ: returns the 4 bytes of `page` (the command itself returns 4 pages). */
export async function readPages(io: TagIO, page: number): Promise<number[]> {
  const response = await send(io, [CMD.READ, page]);
  if (response.length < 16) throw new TagNakError(CMD.READ);
  return response.slice(0, 16);
}

export async function readPage(io: TagIO, page: number): Promise<number[]> {
  return (await readPages(io, page)).slice(0, 4);
}

export async function writePage(io: TagIO, page: number, data: number[]): Promise<void> {
  if (data.length !== 4) throw new Error('A page is 4 bytes');
  const response = await send(io, [CMD.WRITE, page, ...data]);
  // Android returns [0x0A]; iOS may return an empty ACK.
  if (isNak(response) || response.length > 1) throw new TagNakError(CMD.WRITE);
}

/**
 * Identify an NTAG21x from GET_VERSION. Returns null for anything else
 * (MIFARE Ultralight / Ultralight C, NTAG I2C, non-NXP tags). Ultralight C
 * reports the same capability container as an NTAG213 but keeps its 3DES key
 * where NTAG213 keeps PWD/PACK, so guessing from the CC would be unsafe.
 */
export function modelFromVersion(version: number[]): NtagModel | null {
  if (version.length < 8) return null;
  const [, vendor, productType, subtype, major, , storage] = version;
  if (vendor !== 0x04 || productType !== 0x04) return null; // NXP, NTAG
  if (subtype !== 0x01 && subtype !== 0x02) return null; // NTAG21x (17/50 pF); excludes NTAG I2C
  if (major !== 0x01) return null;
  return MODELS_BY_STORAGE[storage] ?? null;
}

/**
 * GET_VERSION → model. A NAK means the chip isn't an NTAG21x (all of them
 * support GET_VERSION); the tag is reselected so the session stays usable.
 */
export async function detectModel(io: TagIO): Promise<NtagModel | null> {
  try {
    return modelFromVersion(await send(io, [CMD.GET_VERSION]));
  } catch (err) {
    if (!(err instanceof TagNakError)) throw err;
    await io.reselect();
    return null;
  }
}

/** PWD_AUTH. True only if the tag accepts the password AND answers with our PACK. */
export async function authenticate(io: TagIO, key: TagKey): Promise<boolean> {
  try {
    const response = await send(io, [CMD.PWD_AUTH, ...key.password]);
    return response.length >= 2 && response[0] === key.pack[0] && response[1] === key.pack[1];
  } catch (err) {
    if (err instanceof TagNakError) return false;
    throw err;
  }
}

export interface TagConfig {
  cfg0: number[];
  cfg1: number[];
  auth0: number;
  access: number;
}

/** One READ at CFG0 returns CFG0, CFG1, PWD, PACK (PWD/PACK read as zero). */
export async function readConfig(io: TagIO, model: NtagModel): Promise<TagConfig> {
  const bytes = await readPages(io, model.cfg0);
  const cfg0 = bytes.slice(0, 4);
  const cfg1 = bytes.slice(4, 8);
  return { cfg0, cfg1, auth0: cfg0[3], access: cfg1[0] };
}

/** Writes to user memory need the password when AUTH0 points inside the tag. */
export const isWriteProtected = (model: NtagModel, auth0: number) => auth0 <= packPage(model);

/**
 * Lock with `key`: PWD, PACK, then read-modify-write ACCESS (clear PROT only)
 * and CFG0 (set AUTH0 only, keeping MIRROR/MIRROR_PAGE). AUTH0 goes last so a
 * not-yet-protected tag accepts all four writes. If the tag is already
 * protected the session must be authenticated first.
 */
export async function lock(io: TagIO, model: NtagModel, key: TagKey): Promise<void> {
  const config = await readConfig(io, model);
  if (config.access & ACCESS_CFGLCK) throw new TagLockError('config-locked');

  await writePage(io, pwdPage(model), [...key.password]);
  await writePage(io, packPage(model), [key.pack[0], key.pack[1], 0x00, 0x00]);

  if (config.access & ACCESS_PROT) {
    const cfg1 = [...config.cfg1];
    cfg1[0] = config.access & ~ACCESS_PROT & 0xff;
    await writePage(io, cfg1Page(model), cfg1);
  }
  if (config.auth0 !== FIRST_USER_PAGE) {
    const cfg0 = [...config.cfg0];
    cfg0[3] = FIRST_USER_PAGE;
    await writePage(io, model.cfg0, cfg0);
  }

  const after = await readConfig(io, model);
  if (after.auth0 !== FIRST_USER_PAGE || after.access & ACCESS_PROT) {
    throw new TagLockError('verify-failed');
  }
}

/** Remove protection (AUTH0 = 0xFF). The session must be authenticated. */
export async function unlock(io: TagIO, model: NtagModel): Promise<void> {
  const config = await readConfig(io, model);
  if (config.auth0 === AUTH0_DISABLED) return;
  if (config.access & ACCESS_CFGLCK) throw new TagLockError('config-locked');
  const cfg0 = [...config.cfg0];
  cfg0[3] = AUTH0_DISABLED;
  await writePage(io, model.cfg0, cfg0);
}

// ── NDEF over page writes ────────────────────────────────────────────────

/** NDEF TLV for a message: 0x03, length (1 or 3 bytes), message. */
function ndefTlv(message: number[]): number[] {
  const len = message.length;
  const header = len < 0xff ? [0x03, len] : [0x03, 0xff, (len >> 8) & 0xff, len & 0xff];
  return [...header, ...message];
}

/**
 * Byte offset (from page 4) where the NDEF TLV starts, keeping any Lock /
 * Memory Control TLVs in front of it (factory NTAG21x tags ship with one).
 */
export function findNdefOffset(area: number[]): number {
  let i = 0;
  while (i < area.length) {
    const t = area[i];
    if (t === 0x00) {
      i += 1;
    } else if (t === 0x01 || t === 0x02) {
      if (i + 1 >= area.length || area[i + 1] === 0xff) return 0;
      i += 2 + area[i + 1];
    } else if (t === 0x03 || t === 0xfe) {
      return i;
    } else {
      return 0;
    }
  }
  return 0;
}

/**
 * Write the first candidate NDEF message that fits into user memory, using
 * plain page writes so the whole operation stays on the authenticated NFC-A
 * link. An empty message (`[]`) erases the tag. Returns the index of the
 * candidate written.
 *
 * Torn-write safety: the TLV header is first rewritten as an empty NDEF,
 * then the body, then the real header — a tag pulled away mid-write reads as
 * empty instead of corrupt.
 */
export async function writeNdef(io: TagIO, model: NtagModel, candidates: number[][]): Promise<number> {
  const head = await readPages(io, 3); // CC (page 3) + pages 4–6
  const cc = head.slice(0, 4);
  if (cc[0] !== 0xe1) throw new TagLockError('not-ndef');
  if ((cc[3] & 0xf0) !== 0x00) throw new TagLockError('read-only');

  const userBytes = (model.userEnd - FIRST_USER_PAGE + 1) * 4;
  const capacity = Math.min(cc[2] * 8 || userBytes, userBytes);
  const firstPages = head.slice(4, 16);
  const offset = findNdefOffset(firstPages);
  const prefix = firstPages.slice(0, offset);

  let chosen = -1;
  let area: number[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const body = [...prefix, ...ndefTlv(candidates[i])];
    if (body.length > capacity) continue;
    if (body.length < capacity) body.push(0xfe); // terminator when there's room
    chosen = i;
    area = body;
    break;
  }
  if (chosen < 0) throw new TagLockError('capacity');

  while (area.length % 4) area.push(0x00);
  const headerLen = candidates[chosen].length < 0xff ? 2 : 4;
  const headerPages = Math.ceil((offset + headerLen) / 4);

  const empty = [...prefix, 0x03, 0x00, 0xfe];
  while (empty.length % 4) empty.push(0x00);

  for (let p = 0; p < empty.length / 4; p++) {
    await writePage(io, FIRST_USER_PAGE + p, empty.slice(p * 4, p * 4 + 4));
  }
  for (let p = headerPages; p < area.length / 4; p++) {
    await writePage(io, FIRST_USER_PAGE + p, area.slice(p * 4, p * 4 + 4));
  }
  for (let p = 0; p < headerPages; p++) {
    await writePage(io, FIRST_USER_PAGE + p, area.slice(p * 4, p * 4 + 4));
  }
  return chosen;
}

// ── the protected operation ──────────────────────────────────────────────

export type LockOutcome =
  /** Locked with the current code during this operation. */
  | 'locked'
  /** Was already locked with the current code; left as is. */
  | 'already-locked'
  /** Lock is off: protection removed using the previous code. */
  | 'unlocked'
  /** Lock is off and the tag wasn't protected. */
  | 'not-locked'
  /** Not an NTAG21x — written without a lock (via the fallback). */
  | 'unsupported';

export interface ProtectedOperation<T> {
  /** The write/erase, run once the tag is writable. Omit to only (un)lock. */
  run?: (model: NtagModel) => Promise<T>;
  /** For tags this module can't lock. Omit to fail with 'unsupported'. */
  fallback?: () => Promise<T>;
}

export interface ProtectedResult<T> {
  outcome: LockOutcome;
  result?: T;
  model: NtagModel | null;
}

/**
 * Detect the tag, authenticate if it's protected (current code, then the
 * previous one), run the operation, then leave the tag locked with the
 * current code — or unlocked when the org lock is off.
 */
export async function runProtected<T>(
  io: TagIO,
  keys: TagLockKeys,
  op: ProtectedOperation<T>
): Promise<ProtectedResult<T>> {
  const model = await detectModel(io);
  if (!model) {
    if (!op.fallback) throw new TagLockError('unsupported');
    return { outcome: 'unsupported', result: await op.fallback(), model: null };
  }

  // Our locks keep PROT = 0, so the config pages are readable without the
  // password. A NAK here means someone else read-protected the tag.
  let config: TagConfig | null = null;
  try {
    config = await readConfig(io, model);
  } catch (err) {
    if (!(err instanceof TagNakError)) throw err;
    await io.reselect();
  }
  const isProtected = !config || isWriteProtected(model, config.auth0);

  let usedKey: TagKey | null = null;
  if (isProtected) {
    const candidates = [keys.current, keys.previous].filter(
      (k, i, all): k is TagKey => !!k && all.findIndex((o) => sameKey(o, k)) === i
    );
    for (let i = 0; i < candidates.length; i++) {
      if (await authenticate(io, candidates[i])) {
        usedKey = candidates[i];
        break;
      }
      await io.reselect();
    }
    if (!usedKey) throw new TagLockError('wrong-code');
  }

  const result = op.run ? await op.run(model) : undefined;

  if (keys.enabled && keys.current) {
    const alreadyLocked =
      sameKey(usedKey, keys.current) &&
      !!config &&
      config.auth0 === FIRST_USER_PAGE &&
      !(config.access & ACCESS_PROT);
    if (alreadyLocked) return { outcome: 'already-locked', result, model };
    await lock(io, model, keys.current);
    return { outcome: 'locked', result, model };
  }

  if (isProtected) {
    await unlock(io, model);
    return { outcome: 'unlocked', result, model };
  }
  return { outcome: 'not-locked', result, model };
}
