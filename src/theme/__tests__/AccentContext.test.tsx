import React from 'react';
import { Text } from 'react-native';
import { render, screen, act } from '@testing-library/react-native';
import { AccentProvider, useAccent, useAccentSetter } from '../AccentContext';
import { tabAccents } from '../tabAccents';

const Probe: React.FC = () => {
  const accent = useAccent();
  return <Text>{accent.key}:{accent.fg}</Text>;
};

const Setter: React.FC<{ to: keyof typeof tabAccents }> = ({ to }) => {
  const set = useAccentSetter();
  React.useEffect(() => {
    set(tabAccents[to]);
  }, [set, to]);
  return null;
};

describe('AccentContext', () => {
  it('provides the dashboard accent by default', () => {
    render(<AccentProvider><Probe /></AccentProvider>);
    expect(screen.getByText('dashboard:#FFC72C')).toBeTruthy();
  });

  it('useAccent returns the dashboard accent when used outside a provider', () => {
    render(<Probe />);
    expect(screen.getByText('dashboard:#FFC72C')).toBeTruthy();
  });

  it('updates accent when the setter is called', () => {
    render(
      <AccentProvider>
        <Setter to="tools" />
        <Probe />
      </AccentProvider>
    );
    expect(screen.getByText('tools:#58A6FF')).toBeTruthy();
  });

  it('useAccentSetter is a no-op outside a provider (does not throw)', () => {
    expect(() =>
      render(<Setter to="tools" />)
    ).not.toThrow();
  });
});
