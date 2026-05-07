import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ActionRow from '../ActionRow';
import type { ActionRow as ActionRowData } from '../../types';

const baseRow: ActionRowData = {
  id: 'overdue-1',
  kind: 'overdue',
  iconName: 'time-outline',
  primary: 'Bosch GH-3544',
  secondary: 'Return overdue · 4 days',
  cta: { kind: 'return', label: 'Return' },
  payload: { assignmentId: 1, toolId: 200 },
};

describe('ActionRow', () => {
  it('renders primary and secondary text', () => {
    render(<ActionRow row={baseRow} onCtaPress={() => {}} />);
    expect(screen.getByText('Bosch GH-3544')).toBeTruthy();
    expect(screen.getByText('Return overdue · 4 days')).toBeTruthy();
  });

  it('renders the CTA label', () => {
    render(<ActionRow row={baseRow} onCtaPress={() => {}} />);
    expect(screen.getByText('Return')).toBeTruthy();
  });

  it('passes the row to onCtaPress when CTA is pressed', () => {
    const onCtaPress = jest.fn();
    render(<ActionRow row={baseRow} onCtaPress={onCtaPress} />);
    fireEvent.press(screen.getByLabelText('Return'));
    expect(onCtaPress).toHaveBeenCalledWith(baseRow);
  });
});
