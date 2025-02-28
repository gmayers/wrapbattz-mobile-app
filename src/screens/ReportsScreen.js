// ReportsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import Card from '../components/Card';
import TabBar from '../components/TabBar';
import { useAuth } from '../context/AuthContext';

const ReportsScreen = ({ navigation }) => {
  const { axiosInstance, logout } = useAuth();
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('reports');

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Reset active tab when returning
      setActiveTab('reports');
      fetchReports();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get('/reports/');
      // Adapt to your response format – here we assume a list or paginated response
      const data = Array.isArray(response.data)
        ? response.data
        : response.data.results || [];
      setReports(data.slice(0, 5));
    } catch (error) {
      console.error('Error fetching reports:', error);
      if (error.response && error.response.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        logout();
      } else {
        Alert.alert('Error', 'Failed to fetch reports. Please try again later.');
      }
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabPress = (key) => {
    if (key === activeTab) return;
    setActiveTab(key);
    switch (key) {
      case 'dashboard':
        navigation.navigate('Dashboard');
        break;
      case 'logout':
        Alert.alert(
          'Logout',
          'Are you sure you want to logout?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setActiveTab('reports') },
            { 
              text: 'Logout', 
              style: 'destructive',
              onPress: () => logout()
            }
          ]
        );
        break;
      default:
        break;
    }
  };

  const tabs = [
    {
      key: 'dashboard',
      title: 'Home',
      icon: <Ionicons name="home-outline" size={24} />,
    },
    {
      key: 'reports',
      title: 'Reports',
      icon: <Ionicons name="document-text-outline" size={24} />,
    },
    {
      key: 'logout',
      title: 'Logout',
      icon: <Ionicons name="log-out-outline" size={24} />,
    }
  ];

  const renderReportCard = (report) => (
    <Card
      key={report.id}
      title={`Device: ${report.device?.identifier || 'Unknown'}`}
      style={styles.reportCard}
    >
      <View style={styles.reportContent}>
        <Text style={styles.reportText}>Date: {report.report_date}</Text>
        <TouchableOpacity 
          onPress={() => Alert.alert('Type Info', report.type)}
          style={styles.typeRow}
        >
          <Text style={styles.reportText}>Type: {report.type}</Text>
          <Ionicons name="information-circle-outline" size={16} color="#666" />
        </TouchableOpacity>
        <Text style={styles.reportText}>Status: {report.status}</Text>
        <Text style={styles.reportText}>Resolved: {report.resolved ? 'Yes' : 'No'}</Text>
        {report.resolved_date && (
          <Text style={styles.reportText}>Resolved Date: {report.resolved_date}</Text>
        )}
        <Text style={styles.reportText}>Description: {report.description}</Text>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <Button
          title="Create Report"
          onPress={() => navigation.navigate('CreateReport')}
          size="small"
        />
      </View>

      <View style={styles.contentContainer}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
        >
          <View style={styles.section}>
            {isLoading ? (
              <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
            ) : reports.length > 0 ? (
              <>
                {reports.map(renderReportCard)}
                <TouchableOpacity
                  style={styles.viewAllButton}
                  onPress={() => navigation.navigate('AllReports')}
                >
                  <Text style={styles.viewAllText}>All Reports</Text>
                  <Ionicons name="chevron-forward" size={16} color="#007AFF" />
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.emptyText}>No reports found</Text>
            )}
          </View>
        </ScrollView>
      </View>

      <TabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabPress={handleTabPress}
        backgroundColor="#FFFFFF"
        activeColor="#007AFF"
        inactiveColor="#666666"
        showIcons={true}
        showLabels={true}
        height={Platform.OS === 'ios' ? 80 : 60}
        containerStyle={styles.tabBarContainer}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contentContainer: {
    flex: 1,
    position: 'relative',
  },
  header: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  section: {
    padding: 15,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  reportCard: {
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  reportContent: {
    gap: 4,
    padding: 15,
  },
  reportText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewAllButton: {
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  viewAllText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
    marginRight: 4,
  },
  loader: {
    marginVertical: 20,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginVertical: 20,
  },
  tabBarContainer: {
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 10,
  },
});

export default ReportsScreen;
