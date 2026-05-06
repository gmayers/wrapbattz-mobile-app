import React from 'react';
import { render, screen } from '@testing-library/react-native';
import StatusPill from '../StatusPill';

describe('StatusPill', () => {
  it('renders the label', () => {
    render(<StatusPill label="Active" tone="green" />);
    expect(screen.getByText('Active')).toBeTruthy();
  });
  it('does not render when label is empty', () => {
    const { toJSON } = render(<StatusPill label="" tone="green" />);
    expect(toJSON()).toBeNull();
  });
});
