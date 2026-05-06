import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import LocationCard from '../LocationCard';

describe('LocationCard', () => {
  const baseProps = {
    kind: 'site' as const,
    name: 'Chelsea Wharf',
    code: 'CHW-04',
    toolCount: 8,
    workerInitials: ['MJ', 'SW', 'LG'],
    onPress: jest.fn(),
  };

  beforeEach(() => baseProps.onPress.mockClear());

  it('renders name, code, count and kind', () => {
    render(<LocationCard {...baseProps} />);
    expect(screen.getByText('Chelsea Wharf')).toBeTruthy();
    expect(screen.getByText('CHW-04')).toBeTruthy();
    expect(screen.getByText('8 tools')).toBeTruthy();
    expect(screen.getByText('SITE')).toBeTruthy();
  });

  it('pluralises tool/tools correctly', () => {
    render(<LocationCard {...baseProps} toolCount={1} />);
    expect(screen.getByText('1 tool')).toBeTruthy();
  });

  it('calls onPress', () => {
    render(<LocationCard {...baseProps} />);
    fireEvent.press(screen.getByLabelText('Site: Chelsea Wharf, 8 tools'));
    expect(baseProps.onPress).toHaveBeenCalledTimes(1);
  });
});
