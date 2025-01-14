import 'expo-dev-client';
import React from 'react';
import { View } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';

export default function App() {
  return (
    <View style={{ flex: 1 }}>
      <HomeScreen />
    </View>
  );
}