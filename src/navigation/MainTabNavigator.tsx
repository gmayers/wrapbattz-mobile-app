import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import MainTabBar from './MainTabBar';
import DashboardScreen from '../screens/Dashboard/DashboardScreen';
import ToolsScreen from '../screens/Tools/ToolsScreen';
import IncidentsScreen from '../screens/Incidents/IncidentsScreen';
import SitesScreen from '../screens/Sites/SitesScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useScanTag } from '../hooks/useScanTag';

const Tab = createBottomTabNavigator();

const MainTabNavigator: React.FC = () => {
  const { userData } = useAuth();
  const { colors } = useTheme();
  const isAdminOrOwner = userData?.role === 'admin' || userData?.role === 'owner';
  const { scan } = useScanTag();

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <Tab.Navigator
        screenOptions={{ headerShown: false }}
        tabBar={props => <MainTabBar {...props} onScanPress={scan} />}
      >
        <Tab.Screen name="dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Dashboard' }} />
        <Tab.Screen name="tools" component={ToolsScreen} options={{ tabBarLabel: 'Tools' }} />
        {isAdminOrOwner ? (
          <Tab.Screen name="sites" component={SitesScreen} options={{ tabBarLabel: 'Sites' }} />
        ) : (
          <Tab.Screen name="incidents" component={IncidentsScreen} options={{ tabBarLabel: 'Incidents' }} />
        )}
        <Tab.Screen name="settings" component={SettingsScreen} options={{ tabBarLabel: 'Settings' }} />
      </Tab.Navigator>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
});

export default MainTabNavigator;
