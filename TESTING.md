# WrapBattz Testing Documentation

This document provides comprehensive information about the testing infrastructure and practices for the WrapBattz React Native application.

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Testing Layers](#testing-layers)
3. [Setup and Installation](#setup-and-installation)
4. [Running Tests](#running-tests)
5. [Writing Tests](#writing-tests)
6. [Sentry Integration](#sentry-integration)
7. [CI/CD Integration](#cicd-integration)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

## Testing Overview

WrapBattz implements a comprehensive 4-layer testing strategy:

- **Unit Tests** - Test individual functions and utilities
- **Component Tests** - Test React components in isolation
- **Integration Tests** - Test component interactions and user flows
- **End-to-End Tests** - Test complete user journeys

All tests are integrated with Sentry for error tracking and monitoring.

## Testing Layers

### 1. Unit Tests

**Purpose**: Test individual functions, utilities, and business logic

**Technology**: Jest

**Location**: `src/tests/unit/`

**Examples**:
- FormValidation utility tests
- NFCUtils tests
- Helper function tests

```bash
# Run unit tests
npm run test src/tests/unit
```

### 2. Component Tests

**Purpose**: Test React components in isolation

**Technology**: Jest + React Native Testing Library

**Location**: `src/tests/component/`

**Examples**:
- FormField component tests
- PasswordField component tests
- Button component tests

```bash
# Run component tests
npm run test src/tests/component
```

### 3. Integration Tests

**Purpose**: Test component interactions and user flows

**Technology**: Jest + React Native Testing Library

**Location**: `src/tests/integration/`

**Examples**:
- Authentication flow tests
- Form submission tests
- Navigation tests

```bash
# Run integration tests
npm run test src/tests/integration
```

### 4. End-to-End Tests

**Purpose**: Test complete user journeys in a real environment

**Technology**: Detox

**Location**: `src/tests/e2e/`

**Examples**:
- Login/Register flow
- Device management workflow
- NFC operations

```bash
# Run E2E tests
npm run test:e2e
```

## Setup and Installation

### Prerequisites

1. Node.js (v16+)
2. React Native development environment
3. Android Studio / Xcode (for E2E tests)
4. Android Emulator / iOS Simulator

### Dependencies

All testing dependencies are already installed:

```json
{
  "@testing-library/react-native": "^13.2.0",
  "detox": "^20.39.0",
  "jest-environment-node": "^30.0.0-beta.3"
}
```

### Configuration

Jest configuration is in `package.json`:

```json
{
  "jest": {
    "preset": "react-native",
    "setupFilesAfterEnv": [
      "@testing-library/react-native/extend-expect",
      "<rootDir>/src/tests/setup.ts"
    ],
    "transformIgnorePatterns": [
      "node_modules/(?!(react-native|@react-native|expo|@expo|@testing-library|@react-navigation|react-native-nfc-manager|@sentry)/)"
    ]
  }
}
```

Detox configuration is in `.detoxrc.js`.

## Running Tests

### All Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for CI
npm run test:ci
```

### Specific Test Types

```bash
# Unit tests only
npm test src/tests/unit

# Component tests only
npm test src/tests/component

# Integration tests only
npm test src/tests/integration

# E2E tests
npm run test:e2e
```

### Test Coverage

```bash
# Generate coverage report
npm run test:coverage

# View coverage report
open coverage/lcov-report/index.html
```

### E2E Tests Setup

```bash
# Build E2E tests
npm run test:e2e:build

# Clean E2E cache
npm run test:e2e:clean

# Run E2E tests
npm run test:e2e
```

## Writing Tests

### Unit Test Example

```typescript
// src/tests/unit/example.test.ts
import { FormValidation } from '../../utils/FormValidation';
import * as Sentry from '@sentry/react-native';

describe('FormValidation', () => {
  it('should validate email addresses', () => {
    const result = FormValidation.email('test@example.com');
    expect(result).toBe(true);
    
    global.testHelpers.sentry.captureTestMessage(
      'Email validation test passed',
      'info'
    );
  });
});
```

### Component Test Example

```typescript
// src/tests/component/example.test.tsx
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import MyComponent from '../../components/MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeTruthy();
  });

  it('should handle user interaction', () => {
    const onPress = jest.fn();
    render(<MyComponent onPress={onPress} />);
    
    fireEvent.press(screen.getByText('Button'));
    expect(onPress).toHaveBeenCalled();
  });
});
```

### Integration Test Example

```typescript
// src/tests/integration/example.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AuthFlow from '../../screens/AuthFlow';

describe('Auth Integration', () => {
  it('should complete login flow', async () => {
    render(<AuthFlow />);
    
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password');
    fireEvent.press(screen.getByText('Login'));
    
    await waitFor(() => {
      expect(screen.getByText('Welcome')).toBeTruthy();
    });
  });
});
```

### E2E Test Example

```typescript
// src/tests/e2e/example.e2e.test.ts
import { device, element, by, expect as detoxExpect } from 'detox';

describe('App E2E', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should show login screen', async () => {
    await detoxExpect(element(by.text('Welcome Back'))).toBeVisible();
  });

  it('should allow login', async () => {
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('password');
    await element(by.id('login-button')).tap();
    
    await detoxExpect(element(by.text('Dashboard'))).toBeVisible();
  });
});
```

## Sentry Integration

All test layers integrate with Sentry for comprehensive error tracking and monitoring.

### Features

- **Error Tracking**: Automatic capture of test failures
- **Performance Monitoring**: Track test execution times
- **Breadcrumbs**: Detailed test execution flow
- **Context**: Rich metadata for debugging

### Test Helpers

Use the global test helpers for Sentry integration:

```typescript
// Capture test errors
global.testHelpers.sentry.captureTestError(error, {
  test: 'test_name',
  component: 'ComponentName',
});

// Capture test messages
global.testHelpers.sentry.captureTestMessage(
  'Test completed successfully',
  'info'
);
```

### Environment Variables

Set up Sentry for testing:

```bash
# .env.test
SENTRY_DSN=your_test_dsn_here
SENTRY_ENVIRONMENT=testing
```

### Test Context

Sentry automatically adds context to test events:

- Test name and suite
- Component being tested
- Test type (unit/component/integration/e2e)
- Platform information
- Error stack traces

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test:ci
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

### Test Scripts for CI

```bash
# Run all tests with coverage and exit
npm run test:ci

# Run specific test suites
npm test -- --testPathPattern=unit
npm test -- --testPathPattern=component
npm test -- --testPathPattern=integration
```

## Best Practices

### Test Structure

1. **Arrange**: Set up test data and mocks
2. **Act**: Execute the functionality being tested
3. **Assert**: Verify the expected outcome

### Naming Conventions

- Test files: `ComponentName.test.tsx`
- E2E tests: `FlowName.e2e.test.ts`
- Test descriptions: Use "should" statements

### Mocking Guidelines

- Mock external dependencies
- Use real implementations for internal code
- Mock network requests
- Mock platform-specific APIs

### Coverage Goals

- **Unit Tests**: 90%+ coverage
- **Component Tests**: 80%+ coverage
- **Integration Tests**: Critical user flows
- **E2E Tests**: Main user journeys

### Error Handling in Tests

```typescript
describe('Error Scenarios', () => {
  it('should handle API errors', async () => {
    try {
      // Test code that might throw
      await riskyOperation();
    } catch (error) {
      global.testHelpers.sentry.captureTestError(error as Error, {
        test: 'api_error_handling',
        operation: 'riskyOperation',
      });
      
      expect(error.message).toContain('Expected error message');
    }
  });
});
```

## Troubleshooting

### Common Issues

#### Jest Issues

```bash
# Clear Jest cache
npx jest --clearCache

# Update snapshots
npm test -- --updateSnapshot
```

#### React Native Testing Library Issues

```bash
# Install missing peer dependencies
npm install --save-dev react-test-renderer
```

#### Detox Issues

```bash
# Clean Detox cache
npm run test:e2e:clean

# Rebuild Detox
npm run test:e2e:build
```

### Debug Mode

Run tests with debug information:

```bash
# Jest debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Detox debug mode
detox test --loglevel trace
```

### Mock Debugging

```typescript
// Debug mock calls
console.log(mockFunction.mock.calls);
console.log(mockFunction.mock.results);
```

### Sentry Debug

Enable Sentry debug mode in tests:

```typescript
Sentry.init({
  debug: true,
  beforeSend: (event) => {
    console.log('Sentry event:', event);
    return event;
  },
});
```

### Performance Issues

- Use `--maxWorkers=1` for debugging
- Increase timeout for slow tests
- Mock heavy operations
- Use `--verbose` for detailed output

## Test Data Management

### Fixtures

Store test data in fixtures:

```typescript
// src/tests/__fixtures__/userData.ts
export const mockUser = {
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
};
```

### Factories

Use factories for generating test data:

```typescript
// src/tests/__factories__/userFactory.ts
export const createUser = (overrides = {}) => ({
  id: Math.random(),
  email: 'test@example.com',
  ...overrides,
});
```

## Continuous Improvement

### Metrics to Monitor

- Test coverage percentage
- Test execution time
- Test failure rate
- Flaky test identification

### Regular Maintenance

- Update test dependencies
- Review and update mocks
- Add tests for new features
- Remove obsolete tests

### Test Reviews

- Include tests in code reviews
- Verify test quality and coverage
- Ensure proper Sentry integration
- Check for test best practices

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Detox Documentation](https://github.com/wix/Detox)
- [Sentry Testing Guide](https://docs.sentry.io/platforms/react-native/guides/testing/)

---

For questions or issues with testing, please refer to this documentation or reach out to the development team.