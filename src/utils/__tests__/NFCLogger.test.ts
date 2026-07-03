import { NfcError } from 'react-native-nfc-manager';
import { nfcLogger, NFCErrorCategory } from '../NFCLogger';

describe('NFCLogger.categorizeError', () => {
  it('categorizes a typed UserCancel error (empty message) as CANCELLED', () => {
    // react-native-nfc-manager rejects cancelled operations with a
    // `NfcError.UserCancel` whose message is "" — see NFCService cancel flow.
    const err = new (NfcError as any).UserCancel();
    expect(err.message).toBe('');
    expect(nfcLogger.categorizeError(err)).toBe(NFCErrorCategory.CANCELLED);
  });

  it('still categorizes message-based cancellations as CANCELLED', () => {
    expect(nfcLogger.categorizeError(new Error('Operation was cancelled'))).toBe(
      NFCErrorCategory.CANCELLED
    );
  });

  it('categorizes genuinely unknown errors as UNKNOWN', () => {
    expect(nfcLogger.categorizeError(new Error('something weird'))).toBe(
      NFCErrorCategory.UNKNOWN
    );
  });
});
