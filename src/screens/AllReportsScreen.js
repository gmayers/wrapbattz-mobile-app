import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import Card from '../components/Card';

const { width } = Dimensions.get('window');

// Orange color to match the app theme
const ORANGE_COLOR = '#FF9500';

// Define the status choices for reports
const STATUS_CHOICES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'ESCALATED', label: 'Escalated' }
];

const AllReportsScreen = ({ navigation, route }) => {
  const {
    deviceService,
    logout,
    userData,
    isAdminOrOwner
  } = useAuth();

  const [activeTab, setActiveTab] = useState('my');
  // State for "My Reports" tab
  const [myReports, setMyReports] = useState([]);
  const [loadingMyReports, setLoadingMyReports] = useState(true);

  // State for "All Reports" tab (admin/owner only)
  const [allReports, setAllReports] = useState([]);
  const [loadingAllReports, setLoadingAllReports] = useState(true);

  // State for update report modal
  const [updateReportModalVisible, setUpdateReportModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [resolvedChecked, setResolvedChecked] = useState(false);

  useEffect(() => {
    fetchMyReports();

    if (isAdminOrOwner) {
      fetchAllReports();
    }
  }, [isAdminOrOwner]);

  const handleApiError = (error, defaultMessage) => {
    if (error.response) {
      const errorMessage = error.response.data.detail || defaultMessage;
      Alert.alert('Error', errorMessage);
    } else if (error.request) {
      Alert.alert('Error', 'No response from server. Please try again later.');
    } else {
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

  // Fetch current user's reports
  const fetchMyReports = async () => {
    try {
      setLoadingMyReports(true);
      const data = await deviceService.getMyReports();
      setMyReports(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      handleApiError(error, 'Failed to fetch your reports');
    } finally {
      setLoadingMyReports(false);
    }
  };

  // Fetch all organization reports (admin/owner only)
  const fetchAllReports = async () => {
    try {
      setLoadingAllReports(true);
      const data = await deviceService.getReports();
      setAllReports(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      handleApiError(error, 'Failed to fetch organization reports.');
    } finally {
      setLoadingAllReports(false);
    }
  };

  // Get status label from value
  const getStatusLabel = (statusValue) => {
    const status = STATUS_CHOICES.find(s => s.value === statusValue);
    return status ? status.label : statusValue;
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

  const handleUpdateReport = (report) => {
    setSelectedReport(report);
    setSelectedStatus(report.status);
    setResolvedChecked(report.resolved || false);
    setUpdateReportModalVisible(true);
  };

  const handleConfirmUpdate = async () => {
    if (!selectedReport || !selectedStatus) {
      Alert.alert('Error', 'Please select a status.');
      return;
    }

    try {
      const updateData = {
        status: selectedStatus,
        resolved: resolvedChecked,
      };

      // If marked as resolved and there's no resolved date, add it
      if (resolvedChecked && !selectedReport.resolved_date) {
        updateData.resolved_date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      }

      await deviceService.updateReport(selectedReport.id, updateData);

      Alert.alert('Success', 'Report has been updated successfully');
      setUpdateReportModalVisible(false);
      fetchMyReports(); // Refresh my reports list
      if (isAdminOrOwner) {
        fetchAllReports(); // Refresh all reports list
      }
    } catch (error) {
      handleApiError(error, 'Failed to update report.');
    }
  };

  // Render report card
// Update the renderReportCard function in AllReportsScreen.js
const renderReportCard = (report) => (
  <TouchableOpacity 
    key={report.id}
    onPress={() => navigation.navigate('ReportDetails', { reportId: report.id })}
    activeOpacity={0.7}
  >
    <Card
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
        <Text style={styles.reportText}>Description: {report.description}</Text>
        <View style={styles.cardActions}>
          <Button
            title="Update Status"
            variant="outlined"
            size="small"
            onPress={(e) => {
              e.stopPropagation(); // Prevent card click
              handleUpdateReport(report);
            }}
            style={styles.updateButton}
          />
        </View>
      </View>
    </Card>
  </TouchableOpacity>
);
  const handleUpdateReportModalClose = () => {
    setUpdateReportModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={ORANGE_COLOR} />
          <Text style={styles.backText}>Reports</Text>
        </TouchableOpacity>
        <Button
          title="Create Report"
          onPress={() => navigation.navigate('CreateReport')}
          size="small"
          textColor="black"
          style={[styles.createReportButton, { backgroundColor: ORANGE_COLOR }]}
        />
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'my' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('my')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'my' && styles.activeTabText
          ]}>
            My Reports
          </Text>
        </TouchableOpacity>

        {isAdminOrOwner && (
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'all' && styles.activeTabButton
            ]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'all' && styles.activeTabText
            ]}>
              All Reports
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* My Reports Tab Content */}
      {activeTab === 'my' && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            {loadingMyReports ? (
              <ActivityIndicator size="large" color={ORANGE_COLOR} style={styles.loader} />
            ) : myReports.length > 0 ? (
              <View style={styles.reportsGrid}>
                {myReports.map(renderReportCard)}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={48} color="#CCCCCC" />
                <Text style={styles.emptyText}>No reports found</Text>
                <Button
                  title="Create Your First Report"
                  onPress={() => navigation.navigate('CreateReport')}
                  size="small"
                  textColor="black"
                  style={[{ marginTop: 15, backgroundColor: ORANGE_COLOR }]}
                />
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* All Reports Tab Content (Admin/Owner only) */}
      {activeTab === 'all' && isAdminOrOwner && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            {loadingAllReports ? (
              <ActivityIndicator size="large" color={ORANGE_COLOR} style={styles.loader} />
            ) : allReports.length > 0 ? (
              <View style={styles.reportsGrid}>
                {allReports.map(renderReportCard)}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={48} color="#CCCCCC" />
                <Text style={styles.emptyText}>No reports found</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Update Report Modal */}
      <Modal
        visible={updateReportModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleUpdateReportModalClose}
      >
        <TouchableWithoutFeedback onPress={handleUpdateReportModalClose}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContainer}>
                {selectedReport && (
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Update Report Status</Text>
                    <Text style={styles.modalText}>
                      Report for: <Text style={styles.modalTextBold}>{selectedReport.device?.identifier || 'Unknown'}</Text>
                    </Text>
                    <Text style={styles.modalText}>
                      Current Status: <Text style={styles.modalTextBold}>{getStatusLabel(selectedReport.status)}</Text>
                    </Text>

                    <Text style={styles.modalText}>Select New Status:</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={selectedStatus}
                        onValueChange={(itemValue) => setSelectedStatus(itemValue)}
                        style={styles.picker}
                        prompt="Select a status"
                      >
                        {STATUS_CHOICES.map((status) => (
                          <Picker.Item key={status.value} label={status.label} value={status.value} />
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
                      title="Update Report"
                      onPress={handleConfirmUpdate}
                      style={styles.confirmButton}
                      disabled={!selectedStatus}
                    />
                    <Button
                      title="Cancel"
                      onPress={handleUpdateReportModalClose}
                      variant="outlined"
                      style={styles.cancelButton}
                    />
                  </View>
                )}
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 17,
    color: ORANGE_COLOR,
    marginLeft: 4,
  },
  createReportButton: {
    paddingHorizontal: 12,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: ORANGE_COLOR,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: ORANGE_COLOR,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 15,
    paddingBottom: 80, // Add extra padding at the bottom for scrolling
  },
  section: {
    flex: 1,
  },
  reportsGrid: {
    width: '100%',
  },
  reportCard: {
    width: '100%',
    marginBottom: 15,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  reportContent: {
    padding: 15,
  },
  reportText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 4,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
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
  cardActions: {
    width: '100%',
    marginTop: 10,
  },
  updateButton: {
    width: '100%',
    borderColor: ORANGE_COLOR,
    backgroundColor: 'transparent',
    borderRadius: 5,
  },
  loader: {
    marginTop: 20,
  },
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
  modalText: {
    fontSize: 16,
    marginBottom: 10,
    color: '#555',
    lineHeight: 22,
  },
  modalTextBold: {
    fontWeight: 'bold',
    color: '#333',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 20,
    justifyContent: 'center',
  },
  picker: {
    height: Platform.OS === 'ios' ? 120 : 50,
    width: '100%',
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
  confirmButton: {
    marginTop: 10,
    backgroundColor: ORANGE_COLOR,
    borderColor: ORANGE_COLOR,
  },
  cancelButton: {
    marginTop: 10,
    borderColor: ORANGE_COLOR,
  },
});

export default AllReportsScreen;