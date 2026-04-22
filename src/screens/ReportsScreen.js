// ReportsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Platform,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import Card from '../components/Card';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { incidents as incidentsApi } from '../api/endpoints';
import { toLegacyReport } from '../api/adapters';
import { ApiError } from '../api/errors';

const { width } = Dimensions.get('window');

// Define the orange color to match HomeScreen
const ORANGE_COLOR = '#FFC72C';

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
  const { userData, user, refreshUser } = useAuth();
  const { colors } = useTheme();

  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get role directly from userData
  const userRole = userData?.role;
  const isAdminOrOwner = userRole === 'admin' || userRole === 'owner';
  
  // Get user's name
  const userName =
    (user?.first_name && `${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}`) ||
    user?.email ||
    'User';

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    if (refreshUser) refreshUser();
  }, [navigation, refreshUser]);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const page = await incidentsApi.listMyIncidents();
      const allReports = page.items.map(toLegacyReport);

      // Sort by most recent first
      allReports.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

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
      if (!(error instanceof ApiError && error.code === 'unauthorized')) {
        const errorMsg =
          (error instanceof ApiError && error.message) ||
          'Failed to fetch your reports. Please try again later.';
        setError(errorMsg);
        Alert.alert('Error', errorMsg);
      }
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  ), [getStatusColor, getStatusLabel, getTypeLabel, handleViewReportDetails]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" />

      {/* Updated Header Section */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View style={styles.welcomeContainer}>
            <Text style={[styles.welcomeText, { color: colors.textPrimary }]}>
              My Reports
            </Text>
          </View>
          
          {/* Profile Button in Header */}
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
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
          style={[styles.createReportButton, { backgroundColor: colors.primary }]}
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
              <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
            ) : error ? (
              <View style={styles.errorView}>
                <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
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
                <Ionicons name="document-text-outline" size={48} color={colors.disabled} />
                <Text style={styles.emptyText}>No reports found</Text>
                <Button
                  title="Create Your First Report"
                  onPress={handleCreateReport}
                  size="small"
                  textColor="black"
                  style={[{ marginTop: 15, backgroundColor: colors.primary }]}
                />
              </View>
            )}

            {reports.length > 0 && (
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={handleViewAllReports}
              >
                <Text style={[styles.viewAllText, { color: ORANGE_COLOR }]}>View All My Reports</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
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
    backgroundColor: '#F5F5F5'
},
  contentContainer: {
    flex: 1,
    position: 'relative'
},
  // Updated header styling
  header: {
    paddingHorizontal: '5%',
    paddingVertical: '3%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: '3%'
},
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
},
  welcomeContainer: {
    flex: 1
},
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    lineHeight: 30
},
  profileButton: {
    marginLeft: 10
},
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
},
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold'
},
  createReportButton: {
    paddingHorizontal: 12,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center'
},
  scrollView: {
    flex: 1
},
  scrollViewContent: {
    flexGrow: 1,
    padding: '4%',
    paddingBottom: 20
},
  section: {
    width: '100%'
},
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333'
},
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15
},
  reportCard: {
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
},
  reportContent: {
    gap: 4,
    padding: 15
},
  reportText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20
},
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
},
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center'
},
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 4
},
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500'
},
  // New style for "View Details" indicator
  viewDetailsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'flex-end'
},
  viewDetailsText: {
    fontSize: 12,
    color: ORANGE_COLOR,
    fontWeight: '500',
    marginRight: 2
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
      height: 2
},
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    height: 48,
    width: '100%'
},
  viewAllText: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8
},
  loader: {
    marginVertical: 20
},
  // Enhanced empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
},
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 10
},
  // Error state styling
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5'
},
  errorView: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30
},
  errorMessage: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 20
},
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 10
}
});

export default ReportsScreen;