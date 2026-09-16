import { ApiError, normalizeFormError } from '../../api/errors';

// Payloads below are real responses captured from
// POST https://app.tooltraq.com/api/v1/auth/register/.
const FALLBACK = 'Something went wrong.';

describe('normalizeFormError', () => {
  it('maps a django-ninja validation body onto plain field names', () => {
    const error = new ApiError({
      code: 'validation',
      status: 422,
      message: 'Invalid request body',
      detail: {
        code: 'validation_error',
        message: 'Invalid request body',
        errors: { 'payload.password': ['String should have at least 12 characters'] },
      },
    });

    const { fieldErrors, message } = normalizeFormError(error, FALLBACK);

    expect(fieldErrors).toEqual({ password: 'String should have at least 12 characters' });
    expect(message).toBe('Invalid request body');
  });

  it('surfaces a coded error with no field errors as a message', () => {
    const error = new ApiError({
      code: 'conflict',
      status: 409,
      message: 'Unable to create account. The email may already be in use.',
      detail: {
        code: 'registration_failed',
        message: 'Unable to create account. The email may already be in use.',
      },
    });

    const { fieldErrors, message } = normalizeFormError(error, FALLBACK);

    // `code` and `message` are envelope keys, not form fields — mapping them
    // onto the form is what made the Register button look dead.
    expect(fieldErrors).toEqual({});
    expect(message).toBe('Unable to create account. The email may already be in use.');
  });

  it('still understands DRF-style {field: [msg]} bodies', () => {
    const error = new ApiError({
      code: 'validation',
      status: 400,
      message: 'Request failed.',
      detail: { email: ['A user with that email already exists.'] },
    });

    expect(normalizeFormError(error, FALLBACK).fieldErrors).toEqual({
      email: 'A user with that email already exists.',
    });
  });

  it('falls back to the error message when there is no body', () => {
    const error = new ApiError({ code: 'network', message: 'Network error — check your connection.' });

    const { fieldErrors, message } = normalizeFormError(error, FALLBACK);

    expect(fieldErrors).toEqual({});
    expect(message).toBe('Network error — check your connection.');
  });

  it('falls back to the caller default for a non-ApiError throw', () => {
    expect(normalizeFormError(new Error(''), FALLBACK).message).toBe(FALLBACK);
    expect(normalizeFormError(undefined, FALLBACK).message).toBe(FALLBACK);
  });
});
