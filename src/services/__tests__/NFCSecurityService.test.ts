import {
  authenticate,
  detectModel,
  findNdefOffset,
  hexToBytes,
  lock,
  modelFromVersion,
  runProtected,
  TagLockError,
  TagLockKeys,
  toTagKey,
  unlock,
  writeNdef,
} from '../NFCSecurityService';
import { FakeNtag } from '../../tests/helpers/fakeNtag';

const CURRENT = { password: [0x00, 0x00, 0x04, 0xd2], pack: [0xa1, 0xb2] };
const PREVIOUS = { password: [0x3f, 0x9a, 0x01, 0xc7], pack: [0x11, 0x22] };
const OTHER = { password: [0xde, 0xad, 0xbe, 0xef], pack: [0x99, 0x88] };

const NTAG213 = modelFromVersion([0x00, 0x04, 0x04, 0x02, 0x01, 0x00, 0x0f, 0x03])!;

const lockedWith = (key: typeof CURRENT, extra: object = {}) =>
  new FakeNtag({ password: key.password, pack: key.pack, auth0: 0x04, ...extra });

describe('password / pack handling', () => {
  it('turns the server hex into PWD and PACK bytes', () => {
    expect(toTagKey('000004D2', 'A1B2')).toEqual(CURRENT);
    expect(toTagKey('3f9a01c7', '1122')).toEqual(PREVIOUS);
  });

  it('returns null when the code is missing', () => {
    expect(toTagKey(null, 'A1B2')).toBeNull();
    expect(toTagKey('000004D2', null)).toBeNull();
  });

  it('rejects malformed hex rather than truncating it', () => {
    expect(() => hexToBytes('1234', 4)).toThrow();
    expect(() => hexToBytes('ZZ0004D2', 4)).toThrow();
    expect(() => hexToBytes('000004D2FF', 4)).toThrow();
  });

  it('accepts PWD_AUTH only when the tag answers with our PACK', async () => {
    const tag = lockedWith(CURRENT);
    await expect(authenticate(tag, CURRENT)).resolves.toBe(true);
    expect(tag.log[0]).toEqual([0x1b, 0x00, 0x00, 0x04, 0xd2]);

    // Right password, but a PACK we didn't write (a cloned/odd tag).
    const odd = lockedWith({ password: CURRENT.password, pack: [0x00, 0x01] });
    await expect(authenticate(odd, CURRENT)).resolves.toBe(false);
  });

  it('treats a NAK as a failed authentication', async () => {
    const tag = lockedWith(CURRENT);
    await expect(authenticate(tag, OTHER)).resolves.toBe(false);
    expect(tag.idle).toBe(true);
  });
});

describe('tag detection', () => {
  it.each([
    [[0x00, 0x04, 0x04, 0x02, 0x01, 0x00, 0x0f, 0x03], 'NTAG213', 0x29],
    [[0x00, 0x04, 0x04, 0x02, 0x01, 0x00, 0x11, 0x03], 'NTAG215', 0x83],
    [[0x00, 0x04, 0x04, 0x02, 0x01, 0x00, 0x13, 0x03], 'NTAG216', 0xe3],
  ])('reads %j as %s', (version, name, cfg0) => {
    expect(modelFromVersion(version)).toMatchObject({ name, cfg0 });
  });

  it('does not mistake other chips for NTAG21x', () => {
    expect(modelFromVersion([0x00, 0x04, 0x03, 0x01, 0x01, 0x00, 0x0b, 0x03])).toBeNull(); // Ultralight EV1
    expect(modelFromVersion([0x00, 0x04, 0x04, 0x05, 0x02, 0x00, 0x13, 0x03])).toBeNull(); // NTAG I2C 1k
    expect(modelFromVersion([0x00, 0x05, 0x04, 0x02, 0x01, 0x00, 0x0f, 0x03])).toBeNull(); // not NXP
  });

  it('reselects after a GET_VERSION NAK and reports no model', async () => {
    const tag = new FakeNtag({ version: null });
    await expect(detectModel(tag)).resolves.toBeNull();
    expect(tag.reselects).toBe(1);
    expect(tag.idle).toBe(false);
  });
});

describe('lock / unlock config bytes', () => {
  it('writes PWD and PACK, and only touches AUTH0 in CFG0 (MIRROR bytes kept)', async () => {
    const tag = new FakeNtag({ mirror: [0xd4, 0x00, 0x14] });
    await lock(tag, NTAG213, CURRENT);
    expect(tag.password).toEqual(CURRENT.password);
    expect(tag.pages[0x2c]).toEqual([0xa1, 0xb2, 0x00, 0x00]);
    expect(tag.pages[0x29]).toEqual([0xd4, 0x00, 0x14, 0x04]);
    // ACCESS was already PROT=0, so CFG1 isn't rewritten.
    expect(tag.log.some((c) => c[0] === 0xa2 && c[1] === 0x2a)).toBe(false);
  });

  it('clears PROT in ACCESS and keeps the other bits', async () => {
    // PROT | NFC_CNT_EN | AUTHLIM=3, still unprotected (AUTH0 = 0xFF).
    const tag = new FakeNtag({ access: 0x80 | 0x10 | 0x03 });
    await lock(tag, NTAG213, CURRENT);
    expect(tag.pages[0x2a]).toEqual([0x13, 0x05, 0x00, 0x00]);
    expect(tag.auth0).toBe(0x04);
  });

  it('writes AUTH0 last so a fresh tag accepts every config write', async () => {
    const tag = new FakeNtag();
    await lock(tag, NTAG213, CURRENT);
    const writes = tag.log.filter((c) => c[0] === 0xa2).map((c) => c[1]);
    expect(writes).toEqual([0x2b, 0x2c, 0x29]);
  });

  it('refuses tags whose configuration is permanently locked', async () => {
    const tag = new FakeNtag({ access: 0x40 });
    await expect(lock(tag, NTAG213, CURRENT)).rejects.toMatchObject({ code: 'config-locked' });
    expect(tag.log.some((c) => c[0] === 0xa2)).toBe(false);
  });

  it('unlock sets AUTH0 to 0xFF and keeps the MIRROR bytes', async () => {
    const tag = lockedWith(CURRENT, { mirror: [0xd4, 0x00, 0x14] });
    await authenticate(tag, CURRENT);
    await unlock(tag, NTAG213);
    expect(tag.pages[0x29]).toEqual([0xd4, 0x00, 0x14, 0xff]);
  });
});

describe('NDEF page writes', () => {
  it('keeps the factory Lock Control TLV in front of the NDEF TLV', async () => {
    expect(findNdefOffset([0x01, 0x03, 0xa0, 0x0c, 0x34, 0x03, 0x00, 0xfe, 0, 0, 0, 0])).toBe(5);
    expect(findNdefOffset([0x03, 0x00, 0xfe, 0x00, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(0);
    expect(findNdefOffset([0x00, 0x00, 0x03, 0x10, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(2);

    const tag = new FakeNtag();
    const message = Array.from({ length: 20 }, (_, i) => i + 1);
    await writeNdef(tag, NTAG213, [message]);
    expect(tag.userBytes(5 + 2 + 20 + 1)).toEqual([0x01, 0x03, 0xa0, 0x0c, 0x34, 0x03, 20, ...message, 0xfe]);
  });

  it('writes an empty header first and the real header last', async () => {
    const tag = new FakeNtag();
    await writeNdef(tag, NTAG213, [Array(30).fill(0x41)]);
    const writes = tag.log.filter((c) => c[0] === 0xa2);
    // Header lives in pages 4–5 (offset 5 + 2-byte header → 2 pages).
    expect(writes[0].slice(1)).toEqual([0x04, 0x01, 0x03, 0xa0, 0x0c]);
    expect(writes[1].slice(1)).toEqual([0x05, 0x34, 0x03, 0x00, 0xfe]);
    expect(writes[writes.length - 1][1]).toBe(0x05);
    expect(writes[writes.length - 1][4]).toBe(30);
  });

  it('falls back to the next candidate when the first does not fit', async () => {
    const tag = new FakeNtag();
    const big = Array(200).fill(0x41); // > 144 bytes of NTAG213 user memory
    const small = [0xd1, 0x01, 0x02];
    await expect(writeNdef(tag, NTAG213, [big, small])).resolves.toBe(1);
    await expect(writeNdef(tag, NTAG213, [big])).rejects.toMatchObject({ code: 'capacity' });
  });

  it('uses a 3-byte length for long messages (NTAG216)', async () => {
    const tag = new FakeNtag({ model: 'NTAG216' });
    const model = modelFromVersion([0x00, 0x04, 0x04, 0x02, 0x01, 0x00, 0x13, 0x03])!;
    const message = Array(300).fill(0x42);
    await writeNdef(tag, model, [message]);
    expect(tag.userBytes(9)).toEqual([0x01, 0x03, 0xa0, 0x0c, 0x34, 0x03, 0xff, 0x01, 0x2c]);
  });

  it('erases with an empty NDEF TLV', async () => {
    const tag = new FakeNtag();
    await writeNdef(tag, NTAG213, [[]]);
    expect(tag.userBytes(8)).toEqual([0x01, 0x03, 0xa0, 0x0c, 0x34, 0x03, 0x00, 0xfe]);
  });

  it('accepts the empty write ACK iOS returns', async () => {
    const tag = new FakeNtag({ emptyAck: true });
    await expect(writeNdef(tag, NTAG213, [[1, 2, 3]])).resolves.toBe(0);
  });
});

describe('runProtected', () => {
  const enabled: TagLockKeys = { enabled: true, current: CURRENT, previous: PREVIOUS };
  const run = jest.fn(async () => 'written');

  beforeEach(() => run.mockClear());

  it('unprotected tag: writes, then locks with the current code', async () => {
    const tag = new FakeNtag();
    const res = await runProtected(tag, enabled, { run });
    expect(res).toMatchObject({ outcome: 'locked', result: 'written' });
    expect(tag.ops()).not.toContain('1b'); // no PWD_AUTH needed
    expect(tag.auth0).toBe(0x04);
    expect(tag.password).toEqual(CURRENT.password);
  });

  it('auth → write → lock happen in that order', async () => {
    const tag = lockedWith(PREVIOUS);
    const order: string[] = [];
    const spy = jest.spyOn(tag, 'transceive');
    await runProtected(tag, enabled, {
      run: async () => {
        order.push('write');
      },
    });
    const sent = spy.mock.calls.map(([c]) => c);
    const firstAuthOk = sent.findIndex((c) => c[0] === 0x1b && c[1] === PREVIOUS.password[0]);
    const pwdWrite = sent.findIndex((c) => c[0] === 0xa2 && c[1] === 0x2b);
    expect(firstAuthOk).toBeGreaterThan(-1);
    expect(pwdWrite).toBeGreaterThan(firstAuthOk);
    expect(order).toEqual(['write']);
  });

  it('tries the current code first, then the previous one, re-locking with current', async () => {
    const tag = lockedWith(PREVIOUS);
    const res = await runProtected(tag, enabled, { run });
    const auths = tag.log.filter((c) => c[0] === 0x1b).map((c) => c.slice(1));
    expect(auths).toEqual([CURRENT.password, PREVIOUS.password]);
    expect(tag.reselects).toBe(1); // after the failed current-code attempt
    expect(res.outcome).toBe('locked');
    expect(tag.password).toEqual(CURRENT.password);
    expect(tag.pack).toEqual(CURRENT.pack);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('leaves a tag already locked with the current code alone', async () => {
    const tag = lockedWith(CURRENT);
    const res = await runProtected(tag, enabled, { run });
    expect(res.outcome).toBe('already-locked');
    const configWrites = tag.log.filter((c) => c[0] === 0xa2 && c[1] >= 0x29);
    expect(configWrites).toEqual([]);
  });

  it('fails clearly when no code opens the tag, without writing', async () => {
    const tag = lockedWith(OTHER);
    await expect(runProtected(tag, enabled, { run })).rejects.toThrow('This tag is locked with a different code');
    expect(run).not.toHaveBeenCalled();
    expect(tag.ops().filter((o) => o === 'a2')).toEqual([]);
  });

  it('authenticates on a read-protected tag after reselecting', async () => {
    const tag = lockedWith(CURRENT, { access: 0x80 });
    const res = await runProtected(tag, enabled, { run });
    expect(res.outcome).toBe('locked');
    expect(tag.access & 0x80).toBe(0); // PROT cleared: tag readable again
  });

  it('lock off with a previous code: authenticates with it, writes, then unlocks', async () => {
    const tag = lockedWith(PREVIOUS);
    const disabled: TagLockKeys = { enabled: false, current: null, previous: PREVIOUS };
    const res = await runProtected(tag, disabled, { run });
    expect(res.outcome).toBe('unlocked');
    expect(tag.auth0).toBe(0xff);
    expect(tag.log.filter((c) => c[0] === 0x1b)).toHaveLength(1);
  });

  it('lock off and the tag is not protected: just writes', async () => {
    const tag = new FakeNtag();
    const res = await runProtected(tag, { enabled: false, current: null, previous: PREVIOUS }, { run });
    expect(res.outcome).toBe('not-locked');
    expect(tag.auth0).toBe(0xff);
  });

  it('uses the fallback for tags it cannot lock', async () => {
    const tag = new FakeNtag({ version: null });
    const fallback = jest.fn(async () => 'ndef');
    const res = await runProtected(tag, enabled, { run, fallback });
    expect(res).toMatchObject({ outcome: 'unsupported', result: 'ndef' });
    expect(run).not.toHaveBeenCalled();
  });

  it('lock-only on an unsupported tag is an error', async () => {
    const tag = new FakeNtag({ version: null });
    await expect(runProtected(tag, enabled, {})).rejects.toBeInstanceOf(TagLockError);
  });

  it('lock-only: authenticates with the previous code and re-locks with current', async () => {
    const tag = lockedWith(PREVIOUS);
    const res = await runProtected(tag, enabled, {});
    expect(res.outcome).toBe('locked');
    expect(tag.password).toEqual(CURRENT.password);
  });

  it('a lost tag during auth surfaces the transport error, not "different code"', async () => {
    const tag = lockedWith(OTHER);
    tag.reselect = jest.fn(async () => {
      throw new Error('Tag was lost');
    });
    await expect(runProtected(tag, enabled, { run })).rejects.toThrow('Tag was lost');
  });

  it('never logs the password', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => {})
    );
    await runProtected(lockedWith(PREVIOUS), enabled, { run });
    await runProtected(lockedWith(OTHER), enabled, { run }).catch(() => {});
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    for (const secret of ['000004D2', '000004d2', '3F9A01C7', '3f9a01c7', '0,0,4,210', '63,154,1,199', '1234']) {
      expect(logged).not.toContain(secret);
    }
    spies.forEach((s) => s.mockRestore());
  });
});
