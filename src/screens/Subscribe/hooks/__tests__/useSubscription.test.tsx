import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as billingApi from '../../../../api/endpoints/billing';
import { useSubscription } from '../useSubscription';

jest.mock('../../../../api/endpoints/billing');

function Probe() {
  const { state, isLoading, error } = useSubscription();
  return <Text testID="probe">{`${isLoading ? 'loading' : 'ready'}|${state?.status ?? 'none'}|${error ?? ''}`}</Text>;
}

describe('useSubscription', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports loading then ready', async () => {
    (billingApi.getSubscription as jest.Mock).mockResolvedValueOnce({
      source: 'apple_iap',
      status: 'active',
    });
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('probe').props.children).toContain('loading');
    await waitFor(() =>
      expect(getByTestId('probe').props.children).toContain('ready|active|'),
    );
  });

  it('reports error message on failure', async () => {
    (billingApi.getSubscription as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const { getByTestId } = render(<Probe />);
    await waitFor(() =>
      expect(getByTestId('probe').props.children).toContain('boom'),
    );
  });
});
