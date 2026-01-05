// ReportsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import Card from '../components/Card';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

// Define the orange color to match HomeScreen
const ORANGE_COLOR = '#FF9500';

// Define report type choices for detailed info
const TYPE_CHOICES = [
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'STOLEN', label: 'Stolen' },
  { value: 'LOST', label: 'Lost' },
  { value: 'MALFUNCTIONING', label: 'Malfunctioning' },
  { value: 'MAINTENANCE', label: 'Needs Maintenance' },
  { value: 'OTHER', label: 'Other' }
];

const STATUS_CHOICES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'ESCALATED', label: 'Escalated' }
];

const ReportsScreen = ({ navigation }) => {
  // Use proper auth context properties
  const { 
    deviceService, 
    logout, 
    userData,
    user,
    refreshRoleInfo,
    error: authError,
    clearError
  } = useAuth();
  
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get role directly from userData
  const userRole = userData?.role;
  const isAdminOrOwner = userRole === 'admin' || userRole === 'owner';
  
  // Get user's name
  const userName = userData?.name || user?.username || user?.email || 'User';

  // Clear any auth errors when component unmounts
  useEffect(() => {
    return () => {
      if (authError) clearError();
    };
  }, [authError, clearError]);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
    
    // Only refresh role info once when component mounts
    if (refreshRoleInfo) {
      refreshRoleInfo();
    }
  }, [navigation]);

  // Use useCallback for improved performance
  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Use deviceService instead of direct axios call
      const reportsData = await deviceService.getMyReports();
      
      // Adapt to your response format
      let allReports = Array.isArray(reportsData)
        ? reportsData
        : reportsData.results || [];

      // Filter to only show pending and in-progress reports first
      const filteredReports = allReports.filter(report =>
        report.status === 'PENDING' || report.status === 'IN_PROGRESS'
      );

      // If there are less than 5 pending/in-progress reports, add other reports until we have 5
      let displayReports = filteredReports;

      if (filteredReports.length < 5) {
        const otherReports = allReports.filter(report =>
          report.status !== 'PENDING' && report.status !== 'IN_PROGRESS'
        );

        const additionalReports = otherReports.slice(0, 5 - filteredReports.length);
        displayReports = [...filteredReports, ...additionalReports];
      } else {
        // If we have more than 5 pending/in-progress reports, only display 5
        displayReports = filteredReports.slice(0, 5);
      }

      setReports(displayReports);
    } catch (error) {
      console.error('Error fetching reports:', error);

      // Skip 401 errors - they're handled globally by the axios interceptor
      if (error.response?.status !== 401) {
        const errorMsg = error.response?.data?.message || 'Failed to fetch your reports. Please try again later.';
        setError(errorMsg);
        Alert.alert('Error', errorMsg);
      }
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }, [deviceService, logout]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchReports();
    });
    return unsubscribe;
  }, [navigation, fetchReports]);



  // Helper function to get status label
  const getStatusLabel = useCallback((statusValue) => {
    const status = STATUS_CHOICES.find(s => s.value === statusValue);
    return status ? status.label : statusValue;
  }, []);

  // Helper function to get type label
  const getTypeLabel = useCallback((typeValue) => {
    const type = TYPE_CHOICES.find(t => t.value === typeValue);
    return type ? type.label : typeValue;
  }, []);

  // Helper function to get status color
  const getStatusColor = useCallback((status) => {
    switch (status) {
      case 'PENDING':
        return '#F59E0B'; // Amber/Yellow
      case 'IN_PROGRESS':
        return '#3B82F6'; // Blue
      case 'RESOLVED':
        return '#10B981'; // Green
      case 'CANCELLED':
        return '#6B7280'; // Gray
      case 'ESCALATED':
        return '#EF4444'; // Red
      default:
        return '#6B7280'; // Gray default
    }
  }, []);

  const handleCreateReport = useCallback(() => {
    navigation.navigate('CreateReport');
  }, [navigation]);

  const handleViewAllReports = useCallback(() => {
    navigation.navigate('AllReports');
  }, [navigation]);
  
  const handleViewReportDetails = useCallback((report) => {
    navigation.navigate('ReportDetails', { reportId: report.id });
  }, [navigation]);

  // Updated to make the card clickable
  const renderReportCard = useCallback((report) => (
    <TouchableOpacity 
      key={report.id}
      onPress={() => handleViewReportDetails(report)}
      activeOpacity={0.7}
    >
      <Card
        title={`Device: ${report.device?.identifier || 'Unknown'}`}
        style={styles.reportCard}
      >
        <View style={styles.reportContent}>
          <Text style={styles.reportText}>Date: {report.report_date}</Text>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation(); // Prevent card click
              Alert.alert('Type Info', getTypeLabel(report.type));
            }}
            style={styles.typeRow}
          >
            <Text style={styles.reportText}>Type: {getTypeLabel(report.type)}</Text>
            <Ionicons name="information-circle-outline" size={16} color="#666" />
          </TouchableOpacity>
          <View style={styles.statusRow}>
            <Text style={styles.reportText}>Status: </Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) }]}>
              <Text style={styles.statusText}>{getStatusLabel(report.status)}</Text>
            </View>
          </View>
          <Text style={styles.reportText}>Resolved: {report.resolved ? 'Yes' : 'No'}</Text>
          {report.resolved_date && (
            <Text style={styles.reportText}>Resolved Date: {report.resolved_date}</Text>
          )}
          <Text 
            style={styles.reportText} 
            numberOfLines={2} // Limit to 2 lines with ellipsis
            ellipsizeMode="tail"
          >
            Description: {report.description}
          </Text>
          <View style={styles.viewDetailsContainer}>
            <Text style={styles.viewDetailsText}>View Details</Text>
            <Ionicons name="chevron-forward" size={14} color={ORANGE_COLOR} />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  ), [getStatusColor, getStatusLabel, getTypeLabel, handleViewReportDetails]);

  // If AuthContext itself has an error state, we could show it here
  if (authError) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorMessage}>{authError}</Text>
        <Button
          title="Try Again"
          onPress={() => {
            clearError();
            fetchReports();
          }}
          size="medium"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Updated Header Section */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>
              My Reports
            </Text>
          </View>
          
          {/* Profile Button in Header */}
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <Button
          title="Create Report"
          onPress={handleCreateReport}
          size="small"
          textColor="black"
          style={[styles.createReportButton, { backgroundColor: ORANGE_COLOR }]}
        />
      </View>

      <View style={styles.contentContainer}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Reports</Text>
            <Text style={styles.sectionSubtitle}>
              {userData?.name ? `Showing ${userData.name}'s` : 'Showing your'} pending and in-progress reports
            </Text>

            {isLoading ? (
              <ActivityIndicator size="large" color={ORANGE_COLOR} style={styles.loader} />
            ) : error ? (
              <View style={styles.errorView}>
                <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
                <Button 
                  title="Try Again" 
                  onPress={fetchReports} 
                  size="small"
                  style={{ marginTop: 10 }}
                />
              </View>
            ) : reports.length > 0 ? (
              <>
                {reports.map(renderReportCard)}
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={48} color="#CCCCCC" />
                <Text style={styles.emptyText}>No reports found</Text>
                <Button
                  title="Create Your First Report"
                  onPress={handleCreateReport}
                  size="small"
                  textColor="black"
                  style={[{ marginTop: 15, backgroundColor: ORANGE_COLOR }]}
                />
              </View>
            )}

            {reports.length > 0 && (
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={handleViewAllReports}
              >
                <Text style={[styles.viewAllText, { color: ORANGE_COLOR }]}>View All My Reports</Text>
                <Ionicons name="chevron-forward" size={16} color={ORANGE_COLOR} />
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>

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
  // Updated header styling
  header: {
    paddingHorizontal: '5%',
    paddingVertical: '3%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: '3%',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  welcomeContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    lineHeight: 30,
  },
  profileButton: {
    marginLeft: 10,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ORANGE_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  createReportButton: {
    paddingHorizontal: 12,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    padding: '4%',
    paddingBottom: 20,
  },
  section: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  // New style for "View Details" indicator
  viewDetailsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  viewDetailsText: {
    fontSize: 12,
    color: ORANGE_COLOR,
    fontWeight: '500',
    marginRight: 2,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    height: 48,
    width: '100%',
  },
  viewAllText: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  loader: {
    marginVertical: 20,
  },
  // Enhanced empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  // Error state styling
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  errorView: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  errorMessage: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 10,
  },
});

export default ReportsScreen;