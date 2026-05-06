import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import MemberCard from '../MemberCard';

describe('MemberCard', () => {
  const baseProps = {
    initials: 'WJ',
    name: 'Wendy Jones',
    metaPrimary: 'CHW-04 · Site lead',
    metaSecondary: 'Last scan 08:12',
    toolCount: 3,
    onViewPress: jest.fn(),
  };

  beforeEach(() => baseProps.onViewPress.mockClear());

  it('renders name, meta, count and View button', () => {
    render(<MemberCard {...baseProps} />);
    expect(screen.getByText('Wendy Jones')).toBeTruthy();
    expect(screen.getByText('CHW-04 · Site lead')).toBeTruthy();
    expect(screen.getByText('Last scan 08:12')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('View')).toBeTruthy();
  });

  it('omits metaSecondary line when undefined', () => {
    render(<MemberCard {...baseProps} metaSecondary={undefined} />);
    expect(screen.queryByText('Last scan 08:12')).toBeNull();
  });

  it('hides View button when onViewPress is undefined', () => {
    const { onViewPress, ...rest } = baseProps;
    render(<MemberCard {...rest} />);
    expect(screen.queryByText('View')).toBeNull();
  });

  it('calls onViewPress when View pressed', () => {
    render(<MemberCard {...baseProps} />);
    fireEvent.press(screen.getByText('View'));
    expect(baseProps.onViewPress).toHaveBeenCalledTimes(1);
  });
});
