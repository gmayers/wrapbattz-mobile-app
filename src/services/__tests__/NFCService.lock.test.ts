// NFCService's locked-tag paths, driven through a mocked NfcManager whose
// NfcA transceive talks to a FakeNtag.
import { Platform } from 'react-native';
import { FakeNtag } from '../../tests/helpers/fakeNtag';
import type { TagLockKeys } from '../NFCSecurityService';

let mockTag: FakeNtag;
const mockCalls: string[] = [];

jest.mock('react-native-nfc-manager', () => {
  const manager = {
    isSupported: jest.fn(async () => true),
    isEnabled: jest.fn(async () => true),
    start: jest.fn(async () => undefined),
    requestTechnology: jest.fn(async () => 'NfcA'),
    restartTechnologyRequestIOS: jest.fn(async () => {
      mockCalls.push('reselect');
      await mockTag.reselect();
      return 'mifare';
    }),
    close: jest.fn(async () => {
      mockCalls.push('close');
    }),
    connect: jest.fn(async (techs: string[]) => {
      mockCalls.push(`connect:${techs.join(',')}`);
      if (techs[0] === 'NfcA') await mockTag.reselect();
    }),
    getTag: jest.fn(async () => ({ id: [0x04, 0xaa, 0xbb] })),
    cancelTechnologyRequest: jest.fn(async () => undefined),
    setAlertMessageIOS: jest.fn(async () => undefined),
    nfcAHandler: {
      transceive: jest.fn((bytes: number[]) => {
        mockCalls.push(`tx:${bytes[0].toString(16)}`);
        return mockTag.transceive(bytes);
      }),
    },
    ndefHandler: {
      writeNdefMessage: jest.fn(async () => {
        mockCalls.push('ndef-write');
      }),
    },
  };
  return {
    __esModule: true,
    default: manager,
    NfcTech: { Ndef: 'Ndef', NfcA: 'NfcA', MifareIOS: 'mifare' },
    Ndef: {
      encodeMessage: jest.fn((records: any[]) =>
        records.flatMap((r) => [0xd1, 0x01, r.payload.length, ...Array.from(r.payload as string, (ch) => ch.charCodeAt(0))])
      ),
      textRecord: jest.fn((text: string) => ({ payload: text, type: 'T' })),
      uriRecord: jest.fn((uri: string) => ({ payload: uri, type: 'U' })),
      text: { decodePayload: jest.fn() },
    },
  };
});

// eslint-disable-next-line import/first
import NfcManager from 'react-native-nfc-manager';
// eslint-disable-next-line import/first
import { NFCService } from '../NFCService';

const CURRENT = { password: [0x00, 0x00, 0x04, 0xd2], pack: [0xa1, 0xb2] };
const PREVIOUS = { password: [0x3f, 0x9a, 0x01, 0xc7], pack: [0x11, 0x22] };
const OTHER = { password: [0xde, 0xad, 0xbe, 0xef], pack: [0x99, 0x88] };
const ENABLED: TagLockKeys = { enabled: true, current: CURRENT, previous: PREVIOUS };
const DISABLED: TagLockKeys = { enabled: false, current: null, previous: PREVIOUS };

const service = NFCService.getInstance();
const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  mockCalls.length = 0;
  (service as any).isInitialized = false;
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  Platform.OS = originalOS;
  jest.restoreAllMocks();
});

describe.each(['android', 'ios'] as const)('locked writes on %s', (os) => {
  beforeEach(() => {
    Platform.OS = os;
    (NfcManager.requestTechnology as jest.Mock).mockResolvedValue(os === 'ios' ? 'mifare' : 'NfcA');
  });

  it('auth → write → lock in one session, without the Ndef API', async () => {
    mockTag = new FakeNtag({ password: PREVIOUS.password, pack: PREVIOUS.pack, auth0: 0x04 });
    const result = await service.writeNFC('{"id":"DRILL-1"}', { lock: ENABLED, uri: 'https://app.tooltraq.com/d/04AABB' });

    expect(result).toMatchObject({ success: true, data: { lockOutcome: 'locked', writtenJson: true } });
    expect(NfcManager.requestTechnology).toHaveBeenCalledTimes(1);
    expect((NfcManager.requestTechnology as jest.Mock).mock.calls[0][0]).toEqual(['NfcA', 'Ndef']);
    expect(NfcManager.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();

    const authOk = mockTag.log.findIndex((c) => c[0] === 0x1b && c[1] === PREVIOUS.password[0]);
    const firstUserWrite = mockTag.log.findIndex((c) => c[0] === 0xa2 && c[1] === 0x04);
    const pwdWrite = mockTag.log.findIndex((c) => c[0] === 0xa2 && c[1] === 0x2b);
    expect(authOk).toBeGreaterThan(-1);
    expect(firstUserWrite).toBeGreaterThan(authOk);
    expect(pwdWrite).toBeGreaterThan(firstUserWrite);
    expect(mockTag.password).toEqual(CURRENT.password);
    expect(mockTag.auth0).toBe(0x04);
    expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  });

  it('re-selects the tag between the current and previous code', async () => {
    mockTag = new FakeNtag({ password: PREVIOUS.password, pack: PREVIOUS.pack, auth0: 0x04 });
    await service.writeNFC('{"id":"X"}', { lock: ENABLED });
    if (os === 'ios') {
      expect(NfcManager.restartTechnologyRequestIOS).toHaveBeenCalledTimes(1);
    } else {
      expect(mockCalls).toContain('close');
      expect(mockCalls).toContain('connect:NfcA');
    }
  });

  it('reports a tag locked with someone else’s code', async () => {
    mockTag = new FakeNtag({ password: OTHER.password, pack: OTHER.pack, auth0: 0x04 });
    const result = await service.writeNFC('{"id":"X"}', { lock: ENABLED });
    expect(result).toEqual({
      success: false,
      error: 'This tag is locked with a different code',
      data: { lockError: 'wrong-code' },
    });
    expect(mockTag.log.filter((c) => c[0] === 0xa2)).toEqual([]);
  });

  it('lock turned off: authenticates with the previous code, writes, then unlocks', async () => {
    mockTag = new FakeNtag({ password: PREVIOUS.password, pack: PREVIOUS.pack, auth0: 0x04 });
    const result = await service.writeNFC('{"id":"X"}', { lock: DISABLED });
    expect(result).toMatchObject({ success: true, data: { lockOutcome: 'unlocked' } });
    expect(mockTag.auth0).toBe(0xff);
  });

  it('falls back to the URI record alone when the JSON does not fit', async () => {
    mockTag = new FakeNtag();
    const big = JSON.stringify({ id: 'X', desc: 'y'.repeat(200) });
    const result = await service.writeNFC(big, { lock: ENABLED, uri: 'https://app.tooltraq.com/d/04AABB' });
    expect(result).toMatchObject({ success: true, data: { writtenJson: false, lockOutcome: 'locked' } });
  });

  it('writes tags it cannot lock through the Ndef API and says so', async () => {
    mockTag = new FakeNtag({ version: null });
    const result = await service.writeNFC('{"id":"X"}', { lock: ENABLED });
    expect(result).toMatchObject({ success: true, data: { lockOutcome: 'unsupported' } });
    expect(NfcManager.ndefHandler.writeNdefMessage).toHaveBeenCalledTimes(1);
    if (os === 'android') expect(mockCalls).toContain('connect:Ndef');
  });

  it('erase leaves the tag locked with the current code', async () => {
    mockTag = new FakeNtag({ password: PREVIOUS.password, pack: PREVIOUS.pack, auth0: 0x04 });
    const result = await service.formatTag({ lock: ENABLED });
    expect(result).toMatchObject({ success: true, data: { wasCleared: true, lockOutcome: 'locked' } });
    expect(mockTag.userBytes(8)).toEqual([0x01, 0x03, 0xa0, 0x0c, 0x34, 0x03, 0x00, 0xfe]);
    expect(mockTag.password).toEqual(CURRENT.password);
  });

  it('"Lock this tag" locks an unprotected tag without rewriting it', async () => {
    mockTag = new FakeNtag();
    const before = mockTag.userBytes(16);
    const result = await service.lockTag(ENABLED);
    expect(result).toMatchObject({ success: true, data: { lockOutcome: 'locked' } });
    expect(mockTag.userBytes(16)).toEqual(before);
    expect(mockTag.auth0).toBe(0x04);
  });
});

describe('without lock keys', () => {
  it('keeps the existing Ndef write path', async () => {
    Platform.OS = 'android';
    (NfcManager.requestTechnology as jest.Mock).mockResolvedValue('Ndef');
    (NfcManager.getTag as jest.Mock).mockResolvedValueOnce({ id: [1], ndefMessage: [], maxSize: 500, isWritable: true });
    const result = await service.writeNFC('{"id":"X"}', { lock: null });
    expect(result.success).toBe(true);
    expect(NfcManager.nfcAHandler.transceive).not.toHaveBeenCalled();
    expect(NfcManager.ndefHandler.writeNdefMessage).toHaveBeenCalledTimes(1);
  });

  it('lockTag refuses when the org lock is off', async () => {
    const result = await service.lockTag(DISABLED);
    expect(result.success).toBe(false);
    expect(NfcManager.requestTechnology).not.toHaveBeenCalled();
  });
});

it('never logs the lock password', async () => {
  Platform.OS = 'android';
  (NfcManager.requestTechnology as jest.Mock).mockResolvedValue('NfcA');
  const spies = [console.log, console.warn, console.error].map((fn) => fn as unknown as jest.Mock);
  mockTag = new FakeNtag({ password: PREVIOUS.password, pack: PREVIOUS.pack, auth0: 0x04 });
  await service.writeNFC('{"id":"X"}', { lock: ENABLED });
  mockTag = new FakeNtag({ password: OTHER.password, pack: OTHER.pack, auth0: 0x04 });
  await service.writeNFC('{"id":"X"}', { lock: ENABLED });
  const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
  for (const secret of ['000004D2', '000004d2', '0,0,4,210', '63,154,1,199', '3F9A01C7']) {
    expect(logged).not.toContain(secret);
  }
});
