import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ToolCard from '../ToolCard';

describe('ToolCard', () => {
  const baseProps = {
    name: 'DeWalt Impact Driver',
    identifier: 'DCF887',
    onPress: jest.fn(),
  };
  beforeEach(() => baseProps.onPress.mockClear());

  it('renders name and identifier', () => {
    render(<ToolCard {...baseProps} />);
    expect(screen.getByText('DeWalt Impact Driver')).toBeTruthy();
    expect(screen.getByText('DCF887')).toBeTruthy();
  });

  it('renders status pill when provided', () => {
    render(<ToolCard {...baseProps} status="Active" />);
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('renders assignee row when provided', () => {
    render(<ToolCard {...baseProps} assigneeName="Wendy Jones" />);
    expect(screen.getByText('Wendy Jones')).toBeTruthy();
  });

  it('omits assignee row when not provided', () => {
    render(<ToolCard {...baseProps} />);
    expect(screen.queryByText(/Wendy Jones/)).toBeNull();
  });

  it('calls onPress', () => {
    render(<ToolCard {...baseProps} />);
    fireEvent.press(screen.getByLabelText('DeWalt Impact Driver'));
    expect(baseProps.onPress).toHaveBeenCalledTimes(1);
  });
});
