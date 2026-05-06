import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ApprovalsBanner from '../ApprovalsBanner';

describe('ApprovalsBanner', () => {
  it('renders nothing when both pending and returns are null', () => {
    const { toJSON } = render(<ApprovalsBanner pendingApprovals={null} returnsDue={null} onReview={() => {}} />);
    expect(toJSON()).toBeNull();
  });
  it('renders pending count when present', () => {
    render(<ApprovalsBanner pendingApprovals={3} returnsDue={null} onReview={() => {}} />);
    expect(screen.getByText(/3 pending approvals/)).toBeTruthy();
  });
  it('renders returns-due count when present', () => {
    render(<ApprovalsBanner pendingApprovals={null} returnsDue={2} onReview={() => {}} />);
    expect(screen.getByText(/2 returns due/)).toBeTruthy();
  });
  it('joins both with separator when both present', () => {
    render(<ApprovalsBanner pendingApprovals={3} returnsDue={2} onReview={() => {}} />);
    expect(screen.getByText('3 pending approvals · 2 returns due')).toBeTruthy();
  });
  it('calls onReview when Review pressed', () => {
    const onReview = jest.fn();
    render(<ApprovalsBanner pendingApprovals={3} returnsDue={null} onReview={onReview} />);
    fireEvent.press(screen.getByText(/Review/));
    expect(onReview).toHaveBeenCalled();
  });
});
