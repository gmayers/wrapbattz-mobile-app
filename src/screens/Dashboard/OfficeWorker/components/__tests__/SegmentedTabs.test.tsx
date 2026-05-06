import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SegmentedTabs from '../SegmentedTabs';

describe('SegmentedTabs', () => {
  it('renders both labels', () => {
    render(<SegmentedTabs left="Where" right="Team" value="left" onChange={() => {}} />);
    expect(screen.getByText('Where')).toBeTruthy();
    expect(screen.getByText('Team')).toBeTruthy();
  });

  it('calls onChange("right") when right tab pressed', () => {
    const onChange = jest.fn();
    render(<SegmentedTabs left="Where" right="Team" value="left" onChange={onChange} />);
    fireEvent.press(screen.getByText('Team'));
    expect(onChange).toHaveBeenCalledWith('right');
  });

  it('does not call onChange when the already-active tab is pressed', () => {
    const onChange = jest.fn();
    render(<SegmentedTabs left="Where" right="Team" value="left" onChange={onChange} />);
    fireEvent.press(screen.getByText('Where'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('marks the active tab as accessibilityState.selected', () => {
    render(<SegmentedTabs left="Where" right="Team" value="right" onChange={() => {}} />);
    const right = screen.getByLabelText('Team tab');
    expect(right.props.accessibilityState).toEqual({ selected: true });
    const left = screen.getByLabelText('Where tab');
    expect(left.props.accessibilityState).toEqual({ selected: false });
  });
});
