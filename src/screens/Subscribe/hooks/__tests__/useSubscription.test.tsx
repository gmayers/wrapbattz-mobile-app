import React from 'react';
import { render, act } from '@testing-library/react-native';
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

  // The backend /billing endpoints were removed; the subscription fetch is
  // disabled until the billing rework lands.
  it('does not call the removed subscription endpoint', async () => {
    const { getByTestId } = render(<Probe />);
    await act(async () => {});
    expect(billingApi.getSubscription).not.toHaveBeenCalled();
    expect(getByTestId('probe').props.children).toBe('ready|none|');
  });
});
