import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as billingApi from '../../../../api/endpoints/billing';
import { ApiError } from '../../../../api/errors';
import { iapEvents } from '../../../../iap/events';
import { useSubscription } from '../useSubscription';

jest.mock('../../../../api/endpoints/billing');

const getSubscription = billingApi.getSubscription as jest.MockedFunction<
  typeof billingApi.getSubscription
>;

function Probe() {
  const { state, isLoading, error } = useSubscription();
  return (
    <Text testID="probe">{`${isLoading ? 'loading' : 'ready'}|${state?.status ?? 'none'}|${error ?? ''}`}</Text>
  );
}

const activeSub = {
  source: 'apple_iap',
  tier_id: 'pro-monthly',
  status: 'active',
  current_period_end: '2026-10-01T00:00:00Z',
  cancel_at_period_end: false,
  purchasing_user_id: 26,
  managed_in: 'app_store',
} as Awaited<ReturnType<typeof billingApi.getSubscription>>;

describe('useSubscription', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches GET /billing/subscription on mount', async () => {
    getSubscription.mockResolvedValueOnce(activeSub);
    const { getByTestId } = render(<Probe />);
    await waitFor(() => expect(getByTestId('probe').props.children).toBe('ready|active|'));
    expect(getSubscription).toHaveBeenCalledTimes(1);
  });

  // Billing not deployed / switch off / no subscription row all land here.
  // The screen shows its empty state, so this must not become an error.
  it('treats an unavailable billing surface as an empty state, not an error', async () => {
    getSubscription.mockRejectedValueOnce(
      new ApiError({ code: 'not_found', status: 404, message: 'Not found' })
    );
    const { getByTestId } = render(<Probe />);
    await waitFor(() => expect(getByTestId('probe').props.children).toBe('ready|none|'));
  });

  it('surfaces a real failure as an error', async () => {
    getSubscription.mockRejectedValueOnce(
      new ApiError({ code: 'server', status: 500, message: 'Boom' })
    );
    const { getByTestId } = render(<Probe />);
    await waitFor(() =>
      expect(getByTestId('probe').props.children).toBe(
        'ready|none|Could not load your subscription.'
      )
    );
  });

  it('refetches when a purchase changes the subscription', async () => {
    getSubscription.mockResolvedValue(activeSub);
    render(<Probe />);
    await waitFor(() => expect(getSubscription).toHaveBeenCalledTimes(1));

    await act(async () => {
      iapEvents.emit('subscription.changed', { source: 'apple_iap' });
    });
    await waitFor(() => expect(getSubscription).toHaveBeenCalledTimes(2));
  });
});
