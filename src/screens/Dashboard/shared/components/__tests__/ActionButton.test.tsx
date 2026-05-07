import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ActionButton from '../ActionButton';

describe('ActionButton', () => {
  it('renders the label', () => {
    render(<ActionButton kind="return" label="Return" onPress={() => {}} />);
    expect(screen.getByText('Return')).toBeTruthy();
  });

  it('calls onPress', () => {
    const onPress = jest.fn();
    render(<ActionButton kind="return" label="Return" onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('Return'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('has accessibility role button', () => {
    render(<ActionButton kind="report" label="Report" onPress={() => {}} />);
    expect(screen.getByLabelText('Report').props.accessibilityRole).toBe('button');
  });

  it('compact variant still calls onPress', () => {
    const onPress = jest.fn();
    render(<ActionButton kind="log" label="Log" variant="compact" onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('Log'));
    expect(onPress).toHaveBeenCalled();
  });
});
