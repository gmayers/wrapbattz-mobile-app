// A small NTAG21x model for tests: page memory, PWD_AUTH state, write/read
// protection from AUTH0 + ACCESS.PROT, and the chip's habit of going IDLE
// after a NAK (every later command fails until the tag is reselected).
import type { TagIO } from '../../services/NFCSecurityService';

export const NTAG213_VERSION = [0x00, 0x04, 0x04, 0x02, 0x01, 0x00, 0x0f, 0x03];
export const NTAG215_VERSION = [0x00, 0x04, 0x04, 0x02, 0x01, 0x00, 0x11, 0x03];
export const NTAG216_VERSION = [0x00, 0x04, 0x04, 0x02, 0x01, 0x00, 0x13, 0x03];

const LAYOUT: Record<string, { cfg0: number; pages: number; cc2: number }> = {
  NTAG213: { cfg0: 0x29, pages: 0x2d, cc2: 0x12 },
  NTAG215: { cfg0: 0x83, pages: 0x87, cc2: 0x3e },
  NTAG216: { cfg0: 0xe3, pages: 0xe7, cc2: 0x6d },
};

export interface FakeNtagOptions {
  model?: 'NTAG213' | 'NTAG215' | 'NTAG216';
  /** null → GET_VERSION is NAKed (e.g. MIFARE Ultralight C). */
  version?: number[] | null;
  password?: number[];
  pack?: number[];
  auth0?: number;
  access?: number;
  mirror?: [number, number, number]; // CFG0 bytes 0–2
  /** Whether WRITE ACKs come back as [0x0A] (Android) or [] (iOS). */
  emptyAck?: boolean;
}

export class FakeNtag implements TagIO {
  pages: number[][];
  cfg0: number;
  version: number[] | null;
  authenticated = false;
  idle = false;
  log: number[][] = [];
  reselects = 0;
  emptyAck: boolean;

  constructor(opts: FakeNtagOptions = {}) {
    const model = opts.model ?? 'NTAG213';
    const layout = LAYOUT[model];
    this.cfg0 = layout.cfg0;
    this.version =
      opts.version === null
        ? null
        : opts.version ?? { NTAG213: NTAG213_VERSION, NTAG215: NTAG215_VERSION, NTAG216: NTAG216_VERSION }[model];
    this.emptyAck = !!opts.emptyAck;
    this.pages = Array.from({ length: layout.pages }, () => [0, 0, 0, 0]);
    this.pages[3] = [0xe1, 0x10, layout.cc2, 0x00];
    // Factory content: Lock Control TLV then an empty NDEF TLV.
    this.pages[4] = [0x01, 0x03, 0xa0, 0x0c];
    this.pages[5] = [0x34, 0x03, 0x00, 0xfe];
    const m = opts.mirror ?? [0x04, 0x00, 0x00];
    this.pages[this.cfg0] = [m[0], m[1], m[2], opts.auth0 ?? 0xff];
    this.pages[this.cfg0 + 1] = [opts.access ?? 0x00, 0x05, 0x00, 0x00];
    this.pages[this.cfg0 + 2] = opts.password ?? [0xff, 0xff, 0xff, 0xff];
    this.pages[this.cfg0 + 3] = [...(opts.pack ?? [0x00, 0x00]), 0x00, 0x00];
  }

  get auth0() {
    return this.pages[this.cfg0][3];
  }
  get access() {
    return this.pages[this.cfg0 + 1][0];
  }
  get password() {
    return this.pages[this.cfg0 + 2];
  }
  get pack() {
    return this.pages[this.cfg0 + 3].slice(0, 2);
  }

  /** Bytes of user memory from page 4. */
  userBytes(count: number): number[] {
    return this.pages.slice(4).flat().slice(0, count);
  }

  private nak(): never {
    this.idle = true;
    this.authenticated = false;
    throw new Error('Transceive failed');
  }

  async reselect(): Promise<void> {
    this.reselects += 1;
    this.idle = false;
    this.authenticated = false;
  }

  async transceive(cmd: number[]): Promise<number[]> {
    this.log.push([...cmd]);
    if (this.idle) throw new Error('Tag was lost');
    const [op, page] = cmd;
    const prot = (this.access & 0x80) !== 0;
    switch (op) {
      case 0x60:
        if (!this.version) this.nak();
        return [...this.version];
      case 0x30: {
        if (page >= this.pages.length) this.nak();
        if (prot && page >= this.auth0 && !this.authenticated) this.nak();
        const out: number[] = [];
        for (let i = 0; i < 4; i++) {
          const p = (page + i) % this.pages.length;
          // PWD and PACK always read back as zeros.
          out.push(...(p === this.cfg0 + 2 || p === this.cfg0 + 3 ? [0, 0, 0, 0] : this.pages[p]));
        }
        return out;
      }
      case 0xa2:
        if (page >= this.pages.length || page < 2) this.nak();
        if (page >= this.auth0 && !this.authenticated) this.nak();
        this.pages[page] = cmd.slice(2, 6);
        return this.emptyAck ? [] : [0x0a];
      case 0x1b: {
        const pwd = cmd.slice(1, 5);
        if (pwd.every((b, i) => b === this.password[i])) {
          this.authenticated = true;
          return this.pack;
        }
        return this.nak();
      }
      default:
        return this.nak();
    }
  }

  /** Commands sent, by opcode, e.g. ['1b', 'a2', ...]. */
  ops(): string[] {
    return this.log.map((c) => c[0].toString(16).padStart(2, '0'));
  }
}
