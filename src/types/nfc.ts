// src/types/nfc.ts - NFC Type Definitions
import type { TagLockKeys } from '../services/NFCSecurityService';

export interface NFCTagData {
  [key: string]: string | number | boolean;
}

export interface NFCOperationResult {
  success: boolean;
  data?: {
    tagId?: string;           // NFC hardware UUID (hex format, uppercase)
    jsonString?: string;
    parsedData?: any;
    content?: string;
    isEmpty?: boolean;
    message?: string;
    wasFormatted?: boolean;
    wasCleared?: boolean;
    [key: string]: any;
  };
  error?: string;
}

export interface DeviceNFCData {
  deviceId: string;
  make: string;
  model: string;
  serialNumber: string;
  maintenanceInterval: number;
  description: string;
}

export interface NFCWriteOptions {
  merge?: boolean;
  timeout?: number;
  // When set, a URI record is written ahead of the JSON text record so a tap
  // deep-links into the app. If the tag is too small for both records, the
  // URI is written alone and the result carries `writtenJson: false`.
  uri?: string;
  // The org's tag lock keys (owners/admins only — see nfcLockStore). When
  // set, the write runs in one NfcA session: authenticate, write, re-lock.
  // `merge` is ignored on that path.
  lock?: TagLockKeys | null;
}

export interface NFCFormatOptions {
  lock?: TagLockKeys | null;
}

export interface NFCReadOptions {
  timeout?: number;
}

// Minimal data structure for simplified NFC tag writes
export interface DeviceNFCDataMinimal {
  id: string;           // Device readable identifier (from server)
  contact?: string;     // Company/organization contact info
}