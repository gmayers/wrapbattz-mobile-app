// DeviceDetailsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import Card from '../components/Card';

const ORANGE_COLOR = '#FF9500';

// Define device type choices
const ITEM_CHOICES = [
  { value: 'LAPTOP', label: 'Laptop' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'TABLET', label: 'Tablet' },
  { value: 'DESKTOP', label: 'Desktop' },
  { value: 'OTHER', label: 'Other' }
];

// Define device status choices
const STATUS_CHOICES = [
  { value: 'available', label: 'Available' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'stolen', label: 'Stolen' },
  { value: 'maintenance', label: 'Maintenance' }
];

const DeviceDetailsScreen = ({ navigation, route }) => {
  const { deviceService, logout, userData, isAdminOrOwner, axiosInstance } = useAuth();
  const { deviceId } = route.params;
  
  const [device, setDevice] = useState(null);
  const [deviceHistory, setDeviceHistory] = useState([]);
  const [deviceReports, setDeviceReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // State for assignment
  const [assignLoading, setAssignLoading] = useState(false);
  
  // Format the date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Helper function to get device type label
  const getDeviceTypeLabel = (typeValue) => {
    const type = ITEM_CHOICES.find(t => t.value === typeValue);
    return type ? type.label : typeValue;
  };

  // Helper function to get status label
  const getStatusLabel = (statusValue) => {
    const status = STATUS_CHOICES.find(s => s.value === statusValue);
    return status ? status.label : statusValue;
  };

  // Helper function to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'available':
        return '#10B981'; // Green
      case 'assigned':
        return '#3B82F6'; // Blue
      case 'damaged':
        return '#EF4444'; // Red
      case 'stolen':
        return '#6B7280'; // Gray
      case 'maintenance':
        return '#F59E0B'; // Amber/Yellow
      default:
        return '#6B7280'; // Gray default
    }
  };

  const handleApiError = (error, defaultMessage) => {
    if (error.response) {
      const errorMessage = error.response.data.detail || defaultMessage;
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } else if (error.request) {
      setError('No response from server. Please try again later.');
      Alert.alert('Error', 'No response from server. Please try again later.');
    } else {
      setError(error.message || defaultMessage);
      Alert.alert('Error', error.message || defaultMessage);
    }

    if (error.response?.status === 401) {
      Alert.alert(
        'Session Expired',
        'Your session has expired. Please login again.',
        [{ text: 'OK', onPress: async () => await logout() }]
      );
    }
  };

  // Fetch device details
  const fetchDeviceDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const deviceData = await deviceService.getDevice(deviceId);
      setDevice(deviceData);
      
    } catch (error) {
      handleApiError(error, 'Failed to fetch device details');
    } finally {
      setLoading(false);
    }
  }, [deviceId, deviceService]);

  // Fetch device assignment history
  const fetchDeviceHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      
      const history = await deviceService.getDeviceHistory(deviceId);
      setDeviceHistory(history);
      
    } catch (error) {
      console.error('Error fetching device history:', error);
      // Don't show alert for secondary data
    } finally {
      setHistoryLoading(false);
    }
  }, [deviceId, deviceService]);

  // Fetch reports for this device
  const fetchDeviceReports = useCallback(async () => {
    try {
      setReportsLoading(true);
      
      // Get all reports and filter for the specific device
      const allReports = await deviceService.getReports();
      const filteredReports = allReports.filter(report => report.device?.id === deviceId);
      
      setDeviceReports(filteredReports);
      
    } catch (error) {
      console.error('Error fetching device reports:', error);
      // Don't show alert for secondary data
    } finally {
      setReportsLoading(false);
    }
  }, [deviceId, deviceService]);

  useEffect(() => {
    fetchDeviceDetails();
    fetchDeviceHistory();
    fetchDeviceReports();
  }, [fetchDeviceDetails, fetchDeviceHistory, fetchDeviceReports]);

  // Handle assign device to current user
  const handleAssignToMe = async () => {
    if (!device || device.status !== 'available') {
      Alert.alert('Error', 'This device is not available for assignment.');
      return;
    }

    setAssignLoading(true);

    try {
      console.log(`Assigning device ${deviceId} to current user`);
      
      // Use the assign-to-me endpoint (same as in SelectMenuTab)
      const response = await axiosInstance.post(
        `/device-assignments/device/${deviceId}/assign-to-me/`
      );
      
      Alert.alert(
        'Success', 
        'Device assigned successfully to your account.',
        [{ text: 'OK', onPress: () => {
          // Refresh device data after assignment
          fetchDeviceDetails();
          fetchDeviceHistory();
        }}]
      );
    } catch (error) {
      console.error('Assignment error:', error);
      
      // Log error details
      if (error.response) {
        console.error('Error status:', error.response.status);
        console.error('Error data:', JSON.stringify(error.response.data, null, 2));
      }
      
      handleApiError(error, 'Failed to assign device');
    } finally {
      setAssignLoading(false);
    }
  };

  // Navigate to create report screen with device pre-selected
  const handleCreateReport = () => {
    navigation.navigate('CreateReport', { 
      selectedDevice: device 
    });
  };

  // Navigate to report details when clicking on a report
  const handleViewReport = (reportId) => {
    navigation.navigate('ReportDetails', { 
      reportId,
      sourceScreen: 'DeviceDetails',
      sourceDeviceId: deviceId 
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color={ORANGE_COLOR} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ORANGE_COLOR} />
          <Text style={styles.loadingText}>Loading device details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !device) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color={ORANGE_COLOR} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error || 'Device not found'}</Text>
          <Button
            title="Try Again"
            onPress={fetchDeviceDetails}
            size="small"
            style={{ marginTop: 20 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Determine if the device is available for assignment
  const canAssign = device.status === 'available';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={ORANGE_COLOR} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Device Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Device Information Card */}
        <View style={styles.detailsCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{device.identifier}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(device.status) }]}>
              <Text style={styles.statusText}>{getStatusLabel(device.status)}</Text>
            </View>
          </View>

          {/* Device Image (if available) */}
          {device.image && (
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: device.image }} 
                style={styles.deviceImage}
                resizeMode="cover"
              />
            </View>
          )}

          <View style={styles.detailsSection}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type:</Text>
              <Text style={styles.detailValue}>{getDeviceTypeLabel(device.device_type)}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Make:</Text>
              <Text style={styles.detailValue}>{device.make}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Model:</Text>
              <Text style={styles.detailValue}>{device.model}</Text>
            </View>
            
            {device.serial_number && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Serial Number:</Text>
                <Text style={styles.detailValue}>{device.serial_number}</Text>
              </View>
            )}
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status:</Text>
              <Text style={styles.detailValue}>{getStatusLabel(device.status)}</Text>
            </View>
            
            {device.maintenance_interval && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Maintenance Interval:</Text>
                <Text style={styles.detailValue}>{device.maintenance_interval} days</Text>
              </View>
            )}
            
            {device.next_maintenance && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Next Maintenance:</Text>
                <Text style={styles.detailValue}>{formatDate(device.next_maintenance)}</Text>
              </View>
            )}
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Created At:</Text>
              <Text style={styles.detailValue}>{formatDate(device.created_at)}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Updated At:</Text>
              <Text style={styles.detailValue}>{formatDate(device.updated_at)}</Text>
            </View>
          </View>

          {device.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.descriptionLabel}>Description:</Text>
              <Text style={styles.descriptionText}>{device.description}</Text>
            </View>
          )}

          <View style={styles.actionButtons}>
            {/* Show assign button only if device is available */}
            {canAssign && (
              <Button
                title={assignLoading ? "Assigning..." : "Assign to Me"}
                onPress={handleAssignToMe}
                disabled={assignLoading}
                style={[styles.assignButton, assignLoading && styles.disabledButton]}
              />
            )}
            
            <Button
              title="Report Issue"
              variant="outlined"
              onPress={handleCreateReport}
              style={styles.reportButton}
            />
          </View>
        </View>

        {/* Assignment History Section */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Assignment History</Text>
          
          {historyLoading ? (
            <ActivityIndicator size="small" color={ORANGE_COLOR} style={styles.sectionLoader} />
          ) : deviceHistory.length > 0 ? (
            deviceHistory.map((assignment, index) => {
              const isActive = !assignment.returned_date;
              
              return (
                <View key={assignment.id} style={[styles.historyItem, isActive && styles.activeHistoryItem]}>
                  {/* Assignment Status Badge */}
                  <View style={styles.historyHeader}>
                    <View style={styles.historyDateContainer}>
                      <Text style={styles.historyDate}>
                        {formatDate(assignment.assigned_date)}
                        {assignment.returned_date ? 
                          ` → ${formatDate(assignment.returned_date)}` : 
                          ' → Current'}
                      </Text>
                      {isActive && (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>ACTIVE</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.assignmentType}>
                      {assignment.user ? 'User Assignment' : 'Location Assignment'}
                    </Text>
                  </View>
                  
                  <View style={styles.historyDetails}>
                    {/* User Assignment */}
                    {assignment.user && assignment.user_name && (
                      <View style={styles.assignmentInfo}>
                        <View style={styles.assignmentIcon}>
                          <Ionicons name="person" size={16} color={ORANGE_COLOR} />
                        </View>
                        <View style={styles.assignmentText}>
                          <Text style={styles.assignmentLabel}>Assigned to Person:</Text>
                          <Text style={styles.assignmentValue}>{assignment.user_name}</Text>
                          {assignment.user_email && (
                            <Text style={styles.assignmentSubtext}>{assignment.user_email}</Text>
                          )}
                        </View>
                      </View>
                    )}
                    
                    {/* Location Assignment */}
                    {assignment.location && assignment.location_name && (
                      <View style={styles.assignmentInfo}>
                        <View style={styles.assignmentIcon}>
                          <Ionicons name="location" size={16} color={ORANGE_COLOR} />
                        </View>
                        <View style={styles.assignmentText}>
                          <Text style={styles.assignmentLabel}>Assigned to Location:</Text>
                          <Text style={styles.assignmentValue}>{assignment.location_name}</Text>
                        </View>
                      </View>
                    )}
                    
                    {/* Assigned By */}
                    {assignment.assigned_by_name && (
                      <View style={styles.assignmentInfo}>
                        <View style={styles.assignmentIcon}>
                          <Ionicons name="person-add" size={16} color="#666" />
                        </View>
                        <View style={styles.assignmentText}>
                          <Text style={styles.assignmentLabel}>Assigned by:</Text>
                          <Text style={styles.assignmentValue}>{assignment.assigned_by_name}</Text>
                        </View>
                      </View>
                    )}
                    
                    {/* Previous Assignment Link */}
                    {assignment.previous_assignment_details && (
                      <View style={styles.previousAssignmentInfo}>
                        <Text style={styles.previousAssignmentLabel}>Previous Assignment:</Text>
                        <Text style={styles.previousAssignmentText}>
                          {assignment.previous_assignment_details.user_name 
                            ? `${assignment.previous_assignment_details.user_name} (${formatDate(assignment.previous_assignment_details.assigned_date)} - ${formatDate(assignment.previous_assignment_details.returned_date)})`
                            : `Location assignment (${formatDate(assignment.previous_assignment_details.assigned_date)} - ${formatDate(assignment.previous_assignment_details.returned_date)})`
                          }
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {index < deviceHistory.length - 1 && <View style={styles.historySeparator} />}
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No assignment history available</Text>
          )}
        </View>

        {/* Reports Section */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Device Reports</Text>
          
          {reportsLoading ? (
            <ActivityIndicator size="small" color={ORANGE_COLOR} style={styles.sectionLoader} />
          ) : deviceReports.length > 0 ? (
            deviceReports.map(report => (
              <TouchableOpacity 
                key={report.id}
                style={styles.reportItem}
                onPress={() => handleViewReport(report.id)}
                activeOpacity={0.7}
              >
                <View style={styles.reportHeader}>
                  <Text style={styles.reportDate}>{formatDate(report.report_date)}</Text>
                  <View style={[
                    styles.reportStatusBadge, 
                    { backgroundColor: getStatusColor(report.status === 'RESOLVED' ? 'available' : 'damaged') }
                  ]}>
                    <Text style={styles.statusText}>{report.status}</Text>
                  </View>
                </View>
                
                <Text style={styles.reportType}>Type: {report.type}</Text>
                <Text 
                  style={styles.reportDescription}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {report.description}
                </Text>
                
                <View style={styles.viewDetailsContainer}>
                  <Text style={styles.viewDetailsText}>View Report Details</Text>
                  <Ionicons name="chevron-forward" size={14} color={ORANGE_COLOR} />
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyReportsContainer}>
              <Text style={styles.emptyText}>No reports for this device</Text>
              <Button
                title="Create Report"
                onPress={handleCreateReport}
                size="small"
                style={{ marginTop: 15, backgroundColor: ORANGE_COLOR }}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 17,
    color: ORANGE_COLOR,
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 15,
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 20,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  imageContainer: {
    width: '100%',
    height: 200,
    marginBottom: 15,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  deviceImage: {
    width: '100%',
    height: '100%',
  },
  detailsSection: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 150,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  descriptionSection: {
    marginBottom: 20,
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 5,
  },
  descriptionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  actionButtons: {
    gap: 10,
  },
  assignButton: {
    backgroundColor: ORANGE_COLOR,
    borderColor: ORANGE_COLOR,
  },
  disabledButton: {
    opacity: 0.5,
  },
  reportButton: {
    borderColor: ORANGE_COLOR,
  },
  sectionLoader: {
    marginVertical: 15,
  },
  historyItem: {
    marginBottom: 15,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  activeHistoryItem: {
    backgroundColor: '#fff3cd',
    borderColor: ORANGE_COLOR,
    borderWidth: 2,
  },
  historyHeader: {
    marginBottom: 12,
  },
  historyDateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  activeBadge: {
    backgroundColor: '#28a745',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  assignmentType: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  historyDetails: {
    gap: 12,
  },
  assignmentInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 8,
  },
  assignmentIcon: {
    width: 24,
    alignItems: 'center',
    marginTop: 2,
  },
  assignmentText: {
    flex: 1,
    marginLeft: 8,
  },
  assignmentLabel: {
    fontSize: 13,
    color: '#6c757d',
    fontWeight: '500',
    marginBottom: 2,
  },
  assignmentValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
  },
  assignmentSubtext: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 2,
  },
  previousAssignmentInfo: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
  },
  previousAssignmentLabel: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
    marginBottom: 4,
  },
  previousAssignmentText: {
    fontSize: 13,
    color: '#495057',
    fontStyle: 'italic',
  },
  historySeparator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 15,
  },
  reportItem: {
    marginBottom: 15,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: ORANGE_COLOR,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportDate: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  reportStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  reportType: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
  },
  reportDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    lineHeight: 18,
  },
  viewDetailsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  viewDetailsText: {
    fontSize: 12,
    color: ORANGE_COLOR,
    fontWeight: '500',
    marginRight: 2,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    marginVertical: 15,
  },
  emptyReportsContainer: {
    alignItems: 'center',
    paddingVertical: 15,
  },
});

export default DeviceDetailsScreen;