// src/utils/NFCLogger.ts - Enhanced logging utility for NFC operations
import * as Sentry from '@sentry/react-native';

/**
 * NFC Operation Types for categorizing different NFC actions
 */
export enum NFCOperationType {
  READ = 'READ',
  WRITE = 'WRITE',
  FORMAT = 'FORMAT',
  LOCK = 'LOCK',
  UNLOCK = 'UNLOCK',
  SCAN_FOR_REGISTRATION = 'SCAN_FOR_REGISTRATION',
  SCAN_FOR_ASSIGNMENT = 'SCAN_FOR_ASSIGNMENT',
}

/**
 * NFC Error Categories for better error tracking and debugging
 */
export enum NFCErrorCategory {
  HARDWARE_NOT_AVAILABLE = 'HARDWARE_NOT_AVAILABLE',
  TAG_NOT_DETECTED = 'TAG_NOT_DETECTED',
  TAG_EMPTY = 'TAG_EMPTY',
  WRITE_FAILED = 'WRITE_FAILED',
  READ_FAILED = 'READ_FAILED',
  TAG_READ_ONLY = 'TAG_READ_ONLY',
  CAPACITY_EXCEEDED = 'CAPACITY_EXCEEDED',
  CANCELLED = 'CANCELLED',
  CONNECTION_LOST = 'CONNECTION_LOST',
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  API_ERROR = 'API_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_DATA = 'INVALID_DATA',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Operation tracking data structure
 */
interface NFCOperation {
  id: string;
  type: NFCOperationType;
  startTime: number;
  steps: Array<{
    name: string;
    timestamp: number;
    data?: Record<string, unknown>;
  }>;
  endTime?: number;
  success?: boolean;
  error?: {
    category: NFCErrorCategory;
    message: string;
    originalError?: Error;
  };
}

/**
 * NFCLogger - Centralized logging utility for NFC operations
 * Provides Sentry integration, operation timing, and error categorization
 */
class NFCLogger {
  private static instance: NFCLogger;
  private debugMode: boolean = __DEV__;
  private currentOperations: Map<string, NFCOperation> = new Map();
  private operationCounter: number = 0;

  private constructor() {}

  public static getInstance(): NFCLogger {
    if (!NFCLogger.instance) {
      NFCLogger.instance = new NFCLogger();
    }
    return NFCLogger.instance;
  }

  /**
   * Enable or disable debug mode
   */
  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Check if debug mode is enabled
   */
  public isDebugMode(): boolean {
    return this.debugMode;
  }

  /**
   * Start tracking an NFC operation
   * @returns Operation ID for tracking
   */
  public startOperation(type: NFCOperationType, metadata?: Record<string, unknown>): string {
    const operationId = `nfc_${type.toLowerCase()}_${++this.operationCounter}_${Date.now()}`;

    const operation: NFCOperation = {
      id: operationId,
      type,
      startTime: Date.now(),
      steps: [],
    };

    this.currentOperations.set(operationId, operation);

    // Add Sentry breadcrumb for operation start
    Sentry.addBreadcrumb({
      category: 'nfc',
      message: `NFC operation started: ${type}`,
      level: 'info',
      data: {
        operationId,
        type,
        ...metadata,
      },
    });

    this.log(`[NFC:${type}] Operation started`, { operationId, ...metadata });

    return operationId;
  }

  /**
   * Log a step within an NFC operation
   */
  public logStep(operationId: string, stepName: string, data?: Record<string, unknown>): void {
    const operation = this.currentOperations.get(operationId);

    if (!operation) {
      this.warn(`No operation found with ID: ${operationId}`);
      return;
    }

    const step = {
      name: stepName,
      timestamp: Date.now(),
      data,
    };

    operation.steps.push(step);

    const elapsed = step.timestamp - operation.startTime;

    // Add Sentry breadcrumb for step
    Sentry.addBreadcrumb({
      category: 'nfc',
      message: `[${operation.type}] ${stepName}`,
      level: 'info',
      data: {
        operationId,
        elapsed: `${elapsed}ms`,
        ...data,
      },
    });

    this.log(`[NFC:${operation.type}] ${stepName} (${elapsed}ms)`, data);
  }

  /**
   * End an NFC operation successfully
   */
  public endOperation(operationId: string, data?: Record<string, unknown>): void {
    const operation = this.currentOperations.get(operationId);

    if (!operation) {
      this.warn(`No operation found with ID: ${operationId}`);
      return;
    }

    operation.endTime = Date.now();
    operation.success = true;

    const totalTime = operation.endTime - operation.startTime;

    // Add Sentry breadcrumb for successful completion
    Sentry.addBreadcrumb({
      category: 'nfc',
      message: `NFC operation completed: ${operation.type}`,
      level: 'info',
      data: {
        operationId,
        totalTime: `${totalTime}ms`,
        steps: operation.steps.length,
        ...data,
      },
    });

    this.log(`[NFC:${operation.type}] Operation completed successfully (${totalTime}ms)`, {
      steps: operation.steps.map(s => s.name),
      ...data,
    });

    // Clean up
    this.currentOperations.delete(operationId);
  }

  /**
   * End an NFC operation with an error
   */
  public endOperationWithError(
    operationId: string,
    error: Error,
    category?: NFCErrorCategory
  ): void {
    const operation = this.currentOperations.get(operationId);

    if (!operation) {
      this.warn(`No operation found with ID: ${operationId}`);
      // Still log the error even without operation context
      this.logError(error, category);
      return;
    }

    operation.endTime = Date.now();
    operation.success = false;

    const errorCategory = category || this.categorizeError(error);

    operation.error = {
      category: errorCategory,
      message: error.message,
      originalError: error,
    };

    const totalTime = operation.endTime - operation.startTime;

    // Add Sentry breadcrumb for error
    Sentry.addBreadcrumb({
      category: 'nfc',
      message: `NFC operation failed: ${operation.type}`,
      level: 'error',
      data: {
        operationId,
        totalTime: `${totalTime}ms`,
        errorCategory,
        errorMessage: error.message,
        steps: operation.steps.map(s => s.name),
      },
    });

    // Capture exception in Sentry for non-cancelled operations
    if (errorCategory !== NFCErrorCategory.CANCELLED) {
      Sentry.captureException(error, {
        tags: {
          nfc_operation: operation.type,
          nfc_error_category: errorCategory,
        },
        extra: {
          operationId,
          totalTime,
          steps: operation.steps,
        },
      });
    }

    this.error(`[NFC:${operation.type}] Operation failed: ${errorCategory} (${totalTime}ms)`, {
      message: error.message,
      steps: operation.steps.map(s => s.name),
    });

    // Clean up
    this.currentOperations.delete(operationId);
  }

  /**
   * Log an error without operation context
   */
  public logError(error: Error, category?: NFCErrorCategory): void {
    const errorCategory = category || this.categorizeError(error);

    Sentry.addBreadcrumb({
      category: 'nfc',
      message: `NFC error: ${errorCategory}`,
      level: 'error',
      data: {
        errorCategory,
        errorMessage: error.message,
      },
    });

    this.error(`[NFC] Error: ${errorCategory}`, { message: error.message });
  }

  /**
   * Categorize an error based on its message
   */
  public categorizeError(error: Error): NFCErrorCategory {
    const message = error.message.toLowerCase();

    if (message.includes('cancelled') || message.includes('canceled')) {
      return NFCErrorCategory.CANCELLED;
    }
    if (message.includes('hardware') || message.includes('not available') || message.includes('not supported')) {
      return NFCErrorCategory.HARDWARE_NOT_AVAILABLE;
    }
    if (message.includes('no nfc tag') || message.includes('no tag detected') || message.includes('tag not detected')) {
      return NFCErrorCategory.TAG_NOT_DETECTED;
    }
    if (message.includes('empty')) {
      return NFCErrorCategory.TAG_EMPTY;
    }
    if (message.includes('read-only') || message.includes('not writable') || message.includes('write-protected')) {
      return NFCErrorCategory.TAG_READ_ONLY;
    }
    if (message.includes('capacity') || message.includes('too large') || message.includes('exceeds')) {
      return NFCErrorCategory.CAPACITY_EXCEEDED;
    }
    if (message.includes('connection lost') || message.includes('tag was lost') || message.includes('disconnected')) {
      return NFCErrorCategory.CONNECTION_LOST;
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return NFCErrorCategory.TIMEOUT;
    }
    if (message.includes('device not found') || message.includes('not registered')) {
      return NFCErrorCategory.DEVICE_NOT_FOUND;
    }
    if (message.includes('api') || message.includes('server') || message.includes('network')) {
      return NFCErrorCategory.API_ERROR;
    }
    if (message.includes('invalid') || message.includes('decode') || message.includes('parse')) {
      return NFCErrorCategory.INVALID_DATA;
    }
    if (message.includes('write') || message.includes('failed to write')) {
      return NFCErrorCategory.WRITE_FAILED;
    }
    if (message.includes('read') || message.includes('failed to read')) {
      return NFCErrorCategory.READ_FAILED;
    }

    return NFCErrorCategory.UNKNOWN;
  }

  /**
   * Get user-friendly error message based on category
   */
  public getUserFriendlyMessage(category: NFCErrorCategory): string {
    switch (category) {
      case NFCErrorCategory.HARDWARE_NOT_AVAILABLE:
        return 'NFC is not available or is disabled on this device. Please check your device settings.';
      case NFCErrorCategory.TAG_NOT_DETECTED:
        return 'No NFC tag detected. Please make sure the tag is positioned correctly near your device.';
      case NFCErrorCategory.TAG_EMPTY:
        return 'This tag is empty. You can write data to it.';
      case NFCErrorCategory.TAG_READ_ONLY:
        return 'This tag is read-only and cannot be written to. Please use a writable NFC tag.';
      case NFCErrorCategory.CAPACITY_EXCEEDED:
        return 'The data is too large for this tag. Please reduce the amount of data or use a higher capacity tag.';
      case NFCErrorCategory.CONNECTION_LOST:
        return 'Connection to the tag was lost. Keep the tag steady and try again.';
      case NFCErrorCategory.TIMEOUT:
        return 'The operation timed out. Keep the tag close to your device and try again.';
      case NFCErrorCategory.CANCELLED:
        return 'The operation was cancelled.';
      case NFCErrorCategory.DEVICE_NOT_FOUND:
        return 'Device not found. This NFC tag is not registered with any device in your organization.';
      case NFCErrorCategory.API_ERROR:
        return 'A server error occurred. Please check your connection and try again.';
      case NFCErrorCategory.INVALID_DATA:
        return 'Could not read tag data. The tag format may be incompatible or corrupted.';
      case NFCErrorCategory.WRITE_FAILED:
        return 'Failed to write to the tag. Keep the tag steady and try again.';
      case NFCErrorCategory.READ_FAILED:
        return 'Failed to read the tag. Please try again.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Internal logging methods
   */
  private log(message: string, data?: Record<string, unknown>): void {
    if (this.debugMode) {
      console.log(`[NFCLogger] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  private warn(message: string, data?: Record<string, unknown>): void {
    if (this.debugMode) {
      console.warn(`[NFCLogger] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  private error(message: string, data?: Record<string, unknown>): void {
    // Always log errors, even in production (they go to Sentry)
    console.error(`[NFCLogger] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
}

// Export singleton instance
export const nfcLogger = NFCLogger.getInstance();

// Export class for testing
export { NFCLogger };
