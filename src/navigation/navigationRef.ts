import { createNavigationContainerRef } from '@react-navigation/native';

// Lets code outside the React tree (notification taps) navigate.
export const navigationRef = createNavigationContainerRef<any>();
