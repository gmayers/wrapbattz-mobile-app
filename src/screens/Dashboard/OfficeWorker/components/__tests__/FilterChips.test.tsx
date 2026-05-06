import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import FilterChips from '../FilterChips';

const ITEMS = [
  { key: 'all', label: 'All' },
  { key: 'sites', label: 'Sites' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'toolboxes', label: 'Toolboxes' },
];

describe('FilterChips', () => {
  it('renders every label', () => {
    render(<FilterChips items={ITEMS} value="all" onChange={() => {}} />);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Sites')).toBeTruthy();
    expect(screen.getByText('Vehicles')).toBeTruthy();
    expect(screen.getByText('Toolboxes')).toBeTruthy();
  });

  it('calls onChange with chip key on press', () => {
    const onChange = jest.fn();
    render(<FilterChips items={ITEMS} value="all" onChange={onChange} />);
    fireEvent.press(screen.getByText('Vehicles'));
    expect(onChange).toHaveBeenCalledWith('vehicles');
  });

  it('marks the active chip selected', () => {
    render(<FilterChips items={ITEMS} value="sites" onChange={() => {}} />);
    expect(screen.getByLabelText('Sites filter').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByLabelText('All filter').props.accessibilityState).toEqual({ selected: false });
  });
});
