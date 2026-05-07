import React from 'react';
import { render, screen } from '@testing-library/react-native';
import TodayLogCard from '../TodayLogCard';

describe('TodayLogCard', () => {
  it('renders three stat cells', () => {
    render(<TodayLogCard checkedOut={4} returnedToday={0} overdueCount={1} />);
    expect(screen.getByText('CHECKED OUT')).toBeTruthy();
    expect(screen.getByText('RETURNED')).toBeTruthy();
    expect(screen.getByText('OVERDUE')).toBeTruthy();
  });

  it('renders the numeric values', () => {
    render(<TodayLogCard checkedOut={4} returnedToday={2} overdueCount={1} />);
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('renders the TODAY’S LOG heading', () => {
    render(<TodayLogCard checkedOut={0} returnedToday={0} overdueCount={0} />);
    expect(screen.getByText("TODAY'S LOG")).toBeTruthy();
  });
});
