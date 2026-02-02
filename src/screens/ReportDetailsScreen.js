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
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Dropdown from '../components/Dropdown';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import { BaseTextInput } from '../components/TextInput';

const ORANGE_COLOR = '#FF9500';
const { width } = Dimensions.get('window');

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
  const { deviceService, logout, userData, isAdminOrOwner, getAccessToken } = useAuth();
  const { reportId } = route.params;

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for images and signatures
  const [reportImages, setReportImages] = useState([]);
  const [reportSignatures, setReportSignatures] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [selectedImageModal, setSelectedImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [authToken, setAuthToken] = useState(null);

  // State for update report modal
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [resolvedChecked, setResolvedChecked] = useState(false);
  const [description, setDescription] = useState('');

  // Fetch auth token for image requests
  useEffect(() => {
    const loadToken = async () => {
      const token = await getAccessToken();
      setAuthToken(token);
    };
    loadToken();
  }, [getAccessToken]);

  useEffect(() => {
    fetchReportDetails();
    fetchReportImages();
  }, [reportId]);

  // Fetch device photos associated with this report
  const fetchReportImages = async () => {
    try {
      console.log('🖼️ [ReportDetails] Fetching images for report:', reportId);
      setLoadingImages(true);

      // Fetch photos filtered by report ID server-side
      const data = await deviceService.getDevicePhotos({ report: reportId });
      console.log('🖼️ [ReportDetails] Raw API response:', {
        isArray: Array.isArray(data),
        hasResults: !!data?.results,
        dataKeys: data ? Object.keys(data) : 'null',
        rawData: JSON.stringify(data).substring(0, 500),
      });

      const photos = Array.isArray(data) ? data : data.results || [];
      console.log('🖼️ [ReportDetails] Parsed photos count:', photos.length);

      // Log each photo's details
      photos.forEach((photo, index) => {
        console.log(`🖼️ [ReportDetails] Photo ${index + 1}:`, {
          id: photo.id,
          image: photo.image,
          is_signature: photo.is_signature,
          device: photo.device,
          report: photo.report,
          created_at: photo.created_at,
        });
      });

      // Separate images and signatures
      const images = photos.filter(photo => !photo.is_signature);
      const signatures = photos.filter(photo => photo.is_signature);

      console.log('🖼️ [ReportDetails] Separated:', {
        imagesCount: images.length,
        signaturesCount: signatures.length,
        imageUrls: images.map(img => img.image),
        signatureUrls: signatures.map(sig => sig.image),
      });

      setReportImages(images);
      setReportSignatures(signatures);
    } catch (error) {
      console.error('❌ [ReportDetails] Failed to fetch report images:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      // Don't show an alert for images, just log the error
    } finally {
      setLoadingImages(false);
    }
  };

  const handleApiError = (error, defaultMessage) => {
    // Skip 401 errors - they're handled globally by the axios interceptor
    if (error.response?.status === 401) {
      return;
    }

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
  };

  const fetchReportDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Make API call to get report details
      // Try to get specific report, fallback to getting all reports and filtering
      let foundReport = null;
      
      try {
        // Try the new getReport method first
        foundReport = await deviceService.getReport(reportId);
      } catch (directError) {
        console.log('Direct report fetch failed, trying to get from all reports:', directError);
        // Fallback: get all reports and filter
        const allReports = await deviceService.getReports();
        foundReport = Array.isArray(allReports) 
          ? allReports.find(r => r.id === reportId)
          : (allReports.results || []).find(r => r.id === reportId);
      }
      
      if (!foundReport) {
        throw new Error('Report not found');
      }
      
      setReport(foundReport);
      
      // Initialize modal state with current values
      setSelectedStatus(foundReport.status);
      setSelectedType(foundReport.type);
      setResolvedChecked(foundReport.resolved || false);
      setDescription(foundReport.description || '');
      
      // Fetch associated images and signatures
      fetchReportImages();
      
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

  // Handle image selection for modal view
  const handleImagePress = (imageUri) => {
    setSelectedImage(imageUri);
    setSelectedImageModal(true);
  };

  // Handle update report confirmation
  // Check if the current user created this report
  const isReportCreator = report?.created_by?.id === userData?.userId;

  const handleConfirmUpdate = async () => {
    try {
      let updateData;

      if (isReportCreator) {
        // Creator can update all fields
        updateData = {
          status: selectedStatus,
          type: selectedType,
          resolved: resolvedChecked,
          description: description,
        };

        if (resolvedChecked && !report.resolved_date) {
          updateData.resolved_date = new Date().toISOString().split('T')[0];
        }
      } else {
        // Admin/owner can only update status
        updateData = {
          status: selectedStatus,
        };

        if (selectedStatus === 'RESOLVED') {
          updateData.resolved = true;
          if (!report.resolved_date) {
            updateData.resolved_date = new Date().toISOString().split('T')[0];
          }
        }
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
            {isAdminOrOwner && (
              <Button
                title="Update Report"
                onPress={handleUpdateReport}
                style={styles.updateButton}
              />
            )}
            
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

        {/* Report Images Section */}
        {loadingImages ? (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Loading Images...</Text>
            <ActivityIndicator size="small" color={ORANGE_COLOR} />
          </View>
        ) : reportImages.length > 0 ? (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Report Images ({reportImages.length})</Text>
            <View style={styles.imagesContainer}>
              {reportImages.map((image, index) => {
                console.log(`🖼️ [ReportDetails] Rendering image ${index + 1}:`, {
                  id: image.id,
                  uri: image.image,
                  hasToken: !!authToken,
                });
                return (
                  <TouchableOpacity
                    key={image.id || index}
                    onPress={() => handleImagePress(image.image)}
                    style={styles.imageContainer}
                  >
                    <Image
                      source={{
                        uri: image.image,
                        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
                      }}
                      style={styles.reportImage}
                      resizeMode="contain"
                      onLoad={() => console.log(`✅ [ReportDetails] Image ${index + 1} loaded successfully:`, image.image)}
                      onError={(e) => console.error(`❌ [ReportDetails] Image ${index + 1} load error:`, {
                        uri: image.image,
                        error: e.nativeEvent.error,
                      })}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Report Signatures Section */}
        {reportSignatures.length > 0 && (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Signatures ({reportSignatures.length})</Text>
            <View style={styles.signaturesContainer}>
              {reportSignatures.map((signature, index) => {
                console.log(`✍️ [ReportDetails] Rendering signature ${index + 1}:`, {
                  id: signature.id,
                  uri: signature.image,
                  hasToken: !!authToken,
                });
                return (
                  <TouchableOpacity
                    key={signature.id || index}
                    onPress={() => handleImagePress(signature.image)}
                    style={styles.signatureContainer}
                  >
                    <Image
                      source={{
                        uri: signature.image,
                        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
                      }}
                      style={styles.signatureImage}
                      resizeMode="contain"
                      onLoad={() => console.log(`✅ [ReportDetails] Signature ${index + 1} loaded successfully:`, signature.image)}
                      onError={(e) => console.error(`❌ [ReportDetails] Signature ${index + 1} load error:`, {
                        uri: signature.image,
                        error: e.nativeEvent.error,
                      })}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

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
              onPress={() => {
                // First check if we have source information from route params
                const { sourceScreen, sourceDeviceId } = route.params || {};
                
                if (sourceScreen === 'DeviceDetails' && sourceDeviceId === report.device.id) {
                  // If we came from the same DeviceDetails, go back instead of navigate
                  navigation.goBack();
                  return;
                }
                
                // Fallback: Check if we came from DeviceDetails by looking at navigation state
                const routes = navigation.getState()?.routes || [];
                const currentIndex = navigation.getState()?.index || 0;
                
                // Look for DeviceDetails in the stack before current screen
                const deviceDetailsInStack = routes.slice(0, currentIndex).find(
                  route => route.name === 'DeviceDetails' && route.params?.deviceId === report.device.id
                );
                
                if (deviceDetailsInStack) {
                  // If we came from the same DeviceDetails, go back instead of navigate
                  navigation.goBack();
                } else {
                  // Check if stack is getting too deep (more than 5 screens)
                  if (routes.length > 5) {
                    // Reset to MainTabs and then navigate to DeviceDetails
                    navigation.reset({
                      index: 1,
                      routes: [
                        { name: 'MainTabs' },
                        { 
                          name: 'DeviceDetails', 
                          params: { 
                            deviceId: report.device.id,
                            sourceScreen: 'ReportDetails'
                          }
                        }
                      ],
                    });
                  } else {
                    // If coming from a different device or no device in stack, navigate normally
                    navigation.navigate('DeviceDetails', { 
                      deviceId: report.device.id,
                      sourceScreen: 'ReportDetails'
                    });
                  }
                }
              }}
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
                  <Text style={styles.modalTitle}>
                    {isReportCreator ? 'Update Report' : 'Update Status'}
                  </Text>

                  <Dropdown
                    label="Status"
                    value={selectedStatus}
                    onValueChange={(itemValue) => setSelectedStatus(itemValue)}
                    items={STATUS_CHOICES}
                    placeholder="Select a status"
                    labelStyle={styles.modalLabel}
                    containerStyle={{ marginBottom: 15 }}
                  />

                  {isReportCreator && (
                    <>
                      <Dropdown
                        label="Type"
                        value={selectedType}
                        onValueChange={(itemValue) => setSelectedType(itemValue)}
                        items={TYPE_CHOICES}
                        placeholder="Select a type"
                        labelStyle={styles.modalLabel}
                        containerStyle={{ marginBottom: 15 }}
                      />

                      <Text style={styles.modalLabel}>Description:</Text>
                      <BaseTextInput
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Enter description"
                        multiline
                        numberOfLines={4}
                        style={styles.modalTextInput}
                      />

                      <TouchableOpacity
                        style={styles.checkboxContainer}
                        onPress={() => setResolvedChecked(!resolvedChecked)}
                      >
                        <View style={[styles.checkbox, resolvedChecked && styles.checkboxChecked]}>
                          {resolvedChecked && <Ionicons name="checkmark" size={16} color="#fff" />}
                        </View>
                        <Text style={styles.checkboxLabel}>Mark as Resolved</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  <Button
                    title={isReportCreator ? 'Update' : 'Update Status'}
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

      {/* Image Viewing Modal */}
      <Modal
        visible={selectedImageModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedImageModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedImageModal(false)}>
          <View style={styles.imageModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.imageModalContainer}>
                <View style={styles.imageModalHeader}>
                  <Text style={styles.imageModalTitle}>Image View</Text>
                  <TouchableOpacity 
                    onPress={() => setSelectedImageModal(false)}
                    style={styles.imageModalCloseButton}
                  >
                    <Ionicons name="close" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                {selectedImage && (
                  <>
                    {console.log('🔍 [ReportDetails] Modal showing image:', selectedImage, 'hasToken:', !!authToken)}
                    <Image
                      source={{
                        uri: selectedImage,
                        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
                      }}
                      style={styles.fullScreenImage}
                      resizeMode="contain"
                      onLoad={() => console.log('✅ [ReportDetails] Modal image loaded successfully:', selectedImage)}
                      onError={(e) => console.error('❌ [ReportDetails] Modal image load error:', {
                        uri: selectedImage,
                        error: e.nativeEvent.error,
                      })}
                    />
                  </>
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
  modalTextInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  // Image and signature styles
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  imageContainer: {
    width: (width - 60) / 2,
    height: 120,
    marginRight: 10,
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  reportImage: {
    width: '100%',
    height: '100%',
  },
  signaturesContainer: {
    marginTop: 10,
  },
  signatureContainer: {
    width: '100%',
    height: 150,
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  signatureImage: {
    width: '100%',
    height: '100%',
  },
  // Image modal styles
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  imageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  imageModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  imageModalCloseButton: {
    padding: 10,
  },
  fullScreenImage: {
    flex: 1,
    width: '100%',
  },
});

export default ReportDetailsScreen;