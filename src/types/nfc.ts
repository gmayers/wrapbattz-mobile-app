// src/types/nfc.ts - NFC Type Definitions

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
}

export interface NFCReadOptions {
  timeout?: number;
}

// Minimal data structure for simplified NFC tag writes
export interface DeviceNFCDataMinimal {
  id: string;           // Device readable identifier (from server)
  contact?: string;     // Company/organization contact info
}