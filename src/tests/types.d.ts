// src/tests/types.d.ts
/// <reference types="jest" />

declare global {
  namespace NodeJS {
    interface Global {
      testHelpers: {
        sentry: {
          captureTestError: (error: Error, context?: Record<string, any>) => void;
          captureTestMessage: (message: string, level?: 'info' | 'warning' | 'error') => void;
        };
      };
    }
  }
}

// Extend expect for React Native Testing Library
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeVisible(): R;
      toBeOnTheScreen(): R;
      toHaveTextContent(text: string): R;
      toHaveDisplayValue(value: string | string[]): R;
      toBeEnabled(): R;
      toBeDisabled(): R;
      toContainElement(element: ReactTestInstance | null): R;
      toBeEmpty(): R;
      toHaveProp(prop: string, value?: any): R;
      toHaveStyle(style: object): R;
      toHaveAccessibilityState(state: object): R;
      toHaveAccessibilityValue(value: object): R;
    }
  }
}

export {};