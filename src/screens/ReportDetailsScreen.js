// ReportDetailsScreen.js
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';

const ORANGE_COLOR = '#FF9500';

// Define the report type choices
const TYPE_CHOICES = [
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'STOLEN', label: 'Stolen' },
  { value: 'LOST', label: 'Lost' },
  { value: 'MALFUNCTIONING', label: 'Malfunctioning' },
  { value: 'MAINTENANCE', label: 'Needs Maintenance' },
  { value: 'OTHER', label: 'Other' }
];

// Define the status choices for reports
const STATUS_CHOICES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'ESCALATED', label: 'Escalated' }
];

const ReportDetailsScreen = ({ navigation, route }) => {
  const { deviceService, logout, userData, isAdminOrOwner } = useAuth();
  const { reportId } = route.params;
  
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for update report modal
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [resolvedChecked, setResolvedChecked] = useState(false);
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchReportDetails();
  }, [reportId]);

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

  const fetchReportDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Make API call to get report details
      // Since there's no specific endpoint for a single report in the provided context,
      // we'll first get all reports and then filter for the specific one
      const allReports = await deviceService.getReports();
      
      // Find the specific report
      const foundReport = allReports.find(r => r.id === reportId);
      
      if (!foundReport) {
        throw new Error('Report not found');
      }
      
      setReport(foundReport);
      
      // Initialize modal state with current values
      setSelectedStatus(foundReport.status);
      setSelectedType(foundReport.type);
      setResolvedChecked(foundReport.resolved || false);
      setDescription(foundReport.description || '');
      
    } catch (error) {
      handleApiError(error, 'Failed to fetch report details');
    } finally {
      setLoading(false);
    }
  };

  // Get status label from value
  const getStatusLabel = (statusValue) => {
    const status = STATUS_CHOICES.find(s => s.value === statusValue);
    return status ? status.label : statusValue;
  };

  // Get type label from value
  const getTypeLabel = (typeValue) => {
    const type = TYPE_CHOICES.find(t => t.value === typeValue);
    return type ? type.label : typeValue;
  };

  // Get status color based on status
  const getStatusColor = (status) => {
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
  };

  // Handle update report button
  const handleUpdateReport = () => {
    setUpdateModalVisible(true);
  };

  // Handle update report confirmation
  const handleConfirmUpdate = async () => {
    try {
      const updateData = {
        status: selectedStatus,
        type: selectedType,
        resolved: resolvedChecked,
        description: description,
      };

      // If marked as resolved and there's no resolved date, add it
      if (resolvedChecked && !report.resolved_date) {
        updateData.resolved_date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      }

      await deviceService.updateReport(reportId, updateData);

      Alert.alert('Success', 'Report has been updated successfully');
      setUpdateModalVisible(false);
      fetchReportDetails(); // Refresh report details
    } catch (error) {
      handleApiError(error, 'Failed to update report');
    }
  };

  const handleDeleteReport = () => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this report? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Since we don't have a specific deleteReport function in the deviceService,
              // this would need to be implemented
              // Placeholder for actual implementation
              Alert.alert('Delete functionality not implemented yet');
              
              // After successful delete:
              // navigation.goBack();
            } catch (error) {
              handleApiError(error, 'Failed to delete report');
            }
          }
        }
      ]
    );
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
          <Text style={styles.loadingText}>Loading report details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !report) {
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
          <Text style={styles.errorText}>{error || 'Report not found'}</Text>
          <Button
            title="Try Again"
            onPress={fetchReportDetails}
            size="small"
            style={{ marginTop: 20 }}
          />
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.headerTitle}>Report Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Report Details Card */}
        <View style={styles.detailsCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Device: {report.device?.identifier || 'Unknown'}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) }]}>
              <Text style={styles.statusText}>{getStatusLabel(report.status)}</Text>
            </View>
          </View>

          <View style={styles.detailsSection}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Report Date:</Text>
              <Text style={styles.detailValue}>{report.report_date}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type:</Text>
              <Text style={styles.detailValue}>{getTypeLabel(report.type)}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status:</Text>
              <Text style={styles.detailValue}>{getStatusLabel(report.status)}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Resolved:</Text>
              <Text style={styles.detailValue}>{report.resolved ? 'Yes' : 'No'}</Text>
            </View>
            
            {report.resolved_date && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Resolved Date:</Text>
                <Text style={styles.detailValue}>{report.resolved_date}</Text>
              </View>
            )}
            
            {report.created_by && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Reported By:</Text>
                <Text style={styles.detailValue}>
                  {report.created_by.first_name} {report.created_by.last_name}
                </Text>
              </View>
            )}
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Created At:</Text>
              <Text style={styles.detailValue}>{new Date(report.created_at).toLocaleString()}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Last Updated:</Text>
              <Text style={styles.detailValue}>{new Date(report.updated_at).toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.descriptionSection}>
            <Text style={styles.descriptionLabel}>Description:</Text>
            <Text style={styles.descriptionText}>{report.description}</Text>
          </View>

          <View style={styles.actionButtons}>
            <Button
              title="Update Report"
              onPress={handleUpdateReport}
              style={styles.updateButton}
            />
            
            {isAdminOrOwner && (
              <Button
                title="Delete Report"
                variant="outlined"
                onPress={handleDeleteReport}
                style={styles.deleteButton}
                textStyle={styles.deleteButtonText}
              />
            )}
          </View>
        </View>

        {/* Device Info Section */}
        {report.device && (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Device Information</Text>
            
            <View style={styles.detailsSection}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Identifier:</Text>
                <Text style={styles.detailValue}>{report.device.identifier}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Type:</Text>
                <Text style={styles.detailValue}>{report.device.device_type}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Make:</Text>
                <Text style={styles.detailValue}>{report.device.make}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Model:</Text>
                <Text style={styles.detailValue}>{report.device.model}</Text>
              </View>
              
              {report.device.serial_number && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Serial Number:</Text>
                  <Text style={styles.detailValue}>{report.device.serial_number}</Text>
                </View>
              )}
            </View>

            <Button
              title="View Device Details"
              variant="outlined"
              onPress={() => navigation.navigate('DeviceDetails', { deviceId: report.device.id })}
              style={styles.viewDeviceButton}
            />
          </View>
        )}
      </ScrollView>

      {/* Update Report Modal */}
      <Modal
        visible={updateModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setUpdateModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setUpdateModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Update Report</Text>
                  
                  <Text style={styles.modalLabel}>Status:</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedStatus}
                      onValueChange={(itemValue) => setSelectedStatus(itemValue)}
                      style={styles.picker}
                    >
                      {STATUS_CHOICES.map((status) => (
                        <Picker.Item key={status.value} label={status.label} value={status.value} />
                      ))}
                    </Picker>
                  </View>
                  
                  <Text style={styles.modalLabel}>Type:</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedType}
                      onValueChange={(itemValue) => setSelectedType(itemValue)}
                      style={styles.picker}
                    >
                      {TYPE_CHOICES.map((type) => (
                        <Picker.Item key={type.value} label={type.label} value={type.value} />
                      ))}
                    </Picker>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.checkboxContainer}
                    onPress={() => setResolvedChecked(!resolvedChecked)}
                  >
                    <View style={[styles.checkbox, resolvedChecked && styles.checkboxChecked]}>
                      {resolvedChecked && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                    <Text style={styles.checkboxLabel}>Mark as Resolved</Text>
                  </TouchableOpacity>
                  
                  <Button
                    title="Update"
                    onPress={handleConfirmUpdate}
                    style={styles.modalUpdateButton}
                  />
                  
                  <Button
                    title="Cancel"
                    variant="outlined"
                    onPress={() => setUpdateModalVisible(false)}
                    style={styles.modalCancelButton}
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
    width: 120,
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
  updateButton: {
    backgroundColor: ORANGE_COLOR,
    borderColor: ORANGE_COLOR,
  },
  deleteButton: {
    borderColor: '#EF4444',
  },
  deleteButtonText: {
    color: '#EF4444',
  },
  viewDeviceButton: {
    borderColor: ORANGE_COLOR,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 25,
  },
  modalContent: {},
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: ORANGE_COLOR,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555',
    marginBottom: 5,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 15,
  },
  picker: {
    height: Platform.OS === 'ios' ? 120 : 50,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: ORANGE_COLOR,
    borderColor: ORANGE_COLOR,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#555',
  },
  modalUpdateButton: {
    backgroundColor: ORANGE_COLOR,
    borderColor: ORANGE_COLOR,
    marginBottom: 10,
  },
  modalCancelButton: {
    borderColor: ORANGE_COLOR,
  },
});

export default ReportDetailsScreen;