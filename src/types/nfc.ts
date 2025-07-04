// src/types/nfc.ts - NFC Type Definitions

export interface NFCTagData {
  [key: string]: string | number | boolean;
}

export interface NFCOperationResult {
  success: boolean;
  data?: {
    jsonString?: string;
    parsedData?: any;
    content?: string;
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