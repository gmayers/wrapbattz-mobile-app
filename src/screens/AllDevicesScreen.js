import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
  Dimensions,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const ORANGE_COLOR = '#FFC72C';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  assignments as assignmentsApi,
  sites as sitesApi
} from '../api/endpoints';
import { toLegacyAssignment, toLegacyLocation } from '../api/adapters';
import { ApiError } from '../api/errors';
import Button from '../components/Button';
import Card from '../components/Card';
import StandardDeviceCard from '../components/StandardDeviceCard';
import SearchBar from '../components/SearchBar';

const { width } = Dimensions.get('window');

const AllDevicesScreen = ({ navigation, route }) => {
  const { userData, isAdminOrOwner } = useAuth();
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState('assignments');
  // State for "My Assignments" tab
  const [myAssignments, setMyAssignments] = useState([]);
  const [loadingMyAssignments, setLoadingMyAssignments] = useState(true);

  // State for "Organization Devices" (now Organization Assignments) tab
  const [organizationAssignments, setOrganizationAssignments] = useState([]);
  const [loadingOrgAssignments, setLoadingOrgAssignments] = useState(false);

  const [locations, setLocations] = useState([]);
  const [returnDeviceModalVisible, setReturnDeviceModalVisible] = useState(false);
  const [selectedReturnDevice, setSelectedReturnDevice] = useState(null);
  const [selectedReturnLocation, setSelectedReturnLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch my assignments and locations once on mount
  useEffect(() => {
    fetchMyAssignments();
    fetchLocations();
  }, []);

  // Fetch org assignments separately — only when user has admin/owner role
  useEffect(() => {
    if (isAdminOrOwner) fetchOrganizationAssignments();
  }, [isAdminOrOwner]);

  const handleApiError = (error, defaultMessage) => {
    // 401s are handled globally by the refresh interceptor.
    if (error instanceof ApiError && error.code === 'unauthorized') return;
    const message =
      (error instanceof ApiError && error.message) ||
      error?.message ||
      defaultMessage;
    Alert.alert('Error', message);
  };

  // Sort: active first, then returned. Within each group: user assignments (A-Z) then location assignments (A-Z)
  const sortAssignments = (list) => {
    return [...list].sort((a, b) => {
      // Primary: active (no returned_date) before returned
      const aActive = !a.returned_date;
      const bActive = !b.returned_date;
      if (aActive !== bActive) return aActive ? -1 : 1;

      // Secondary: user assignments before location-only assignments
      const aIsUser = !!a.user;
      const bIsUser = !!b.user;
      if (aIsUser !== bIsUser) return aIsUser ? -1 : 1;

      // Tertiary: alphabetical by name
      if (aIsUser && bIsUser) return (a.user_name || '').localeCompare(b.user_name || '');
      return (a.location_name || '').localeCompare(b.location_name || '');
    });
  };

  const fetchLocations = async () => {
    try {
      const page = await sitesApi.listSites();
      setLocations(page.items.map(toLegacyLocation));
    } catch (error) {
      // Locations only needed for return modal — assignments still display fine
    }
  };

  // Fetches current user's assignments.
  const fetchMyAssignments = async () => {
    try {
      setLoadingMyAssignments(true);
      const page = await assignmentsApi.listMyAssignments();
      setMyAssignments(sortAssignments(page.items.map(toLegacyAssignment)));
    } catch (error) {
      handleApiError(error, 'Failed to fetch your device assignments');
    } finally {
      setLoadingMyAssignments(false);
    }
  };

  // Fetches all assignments for the organization.
  const fetchOrganizationAssignments = async () => {
    try {
      setLoadingOrgAssignments(true);
      const page = await assignmentsApi.listAssignments();
      setOrganizationAssignments(sortAssignments(page.items.map(toLegacyAssignment)));
    } catch (error) {
      handleApiError(error, 'Failed to fetch organization assignments.');
    } finally {
      setLoadingOrgAssignments(false);
    }
  };

  const handleDeviceReturn = (deviceAssignment, event) => { // Parameter is an assignment object
    // Stop propagation to prevent navigation to details when clicking return button
    event.stopPropagation();
    
    if (!deviceAssignment || !deviceAssignment.device) {
      Alert.alert('Error', 'Invalid device assignment data');
      return;
    }

    setSelectedReturnDevice(deviceAssignment); // selectedReturnDevice is an assignment
    setReturnDeviceModalVisible(true);
    setSelectedReturnLocation(null);
  };

  const handleViewDeviceDetails = (deviceId) => {
    if (deviceId) {
      navigation.navigate('DeviceDetails', { 
        deviceId,
        sourceScreen: 'AllDevices'
      });
    }
  };

  const handleConfirmReturn = async () => {
    if (!selectedReturnLocation || !selectedReturnLocation.id) {
      Alert.alert('Error', 'Please select a location.');
      return;
    }

    if (!selectedReturnDevice || !selectedReturnDevice.id) {
      Alert.alert('Error', 'No device assignment selected for return.');
      return;
    }

    try {
      await assignmentsApi.returnAssignment(Number(selectedReturnDevice.id), {
        target_site_id: Number(selectedReturnLocation.id),
        condition: '',
        notes: ''
});

      Alert.alert('Success', 'Device has been returned successfully');
      setReturnDeviceModalVisible(false);
      setSelectedReturnLocation(null);
      fetchMyAssignments(); // Refresh my assignments list
      if (isAdminOrOwner) {
        fetchOrganizationAssignments(); // Refresh organization assignments list
      }
    } catch (error) {
      handleApiError(error, 'Failed to return device.');
    }
  };

  const renderAssignmentCard = (assignment) => (
    <StandardDeviceCard
      key={assignment.id}
      assignment={assignment}
      onReturn={(a) => handleDeviceReturn(a, { stopPropagation: () => {} })}
      onViewDetails={handleViewDeviceDetails}
      style={styles.deviceCard}
      showActiveStatus={true}
      showReturnButton={true}
    />
  );

  const renderOrgAssignmentCard = (assignment) => (
    <StandardDeviceCard
      key={assignment.id}
      assignment={assignment}
      onReturn={(a) => handleDeviceReturn(a, { stopPropagation: () => {} })}
      onViewDetails={handleViewDeviceDetails}
      style={styles.deviceCard}
      showActiveStatus={true}
      showReturnButton={assignment.user_id === userData?.userId}
    />
  );

  // Renders a card for a device (currently not used for list rendering in this screen based on new requirements)
  // Kept for potential future use or if linked from elsewhere (e.g. DeviceDetails screen)
  const renderDeviceCard = (device) => (
    <TouchableOpacity
      key={device.id}
      activeOpacity={0.7}
      onPress={() => handleViewDeviceDetails(device.id)}
      style={styles.deviceCardWrapper}
    >
      <Card
        title={device.identifier}
        subtitle={device.device_type}
        style={styles.deviceCard}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardInfo}>
            <Text style={styles.infoText}>Make: {device.make}</Text>
            <Text style={styles.infoText}>Model: {device.model}</Text>
            <Text style={styles.infoText}>Serial: {device.serial_number}</Text>
            <Text style={styles.infoText}>Status: {device.active ? 'Active' : 'Inactive'}</Text>
          </View>
          <View style={styles.cardActions}>
            <Button
              title="View Details"
              variant="outlined"
              size="small"
              onPress={(event) => {
                event.stopPropagation();
                navigation.navigate('DeviceDetails', { 
                  deviceId: device.id,
                  sourceScreen: 'AllDevices'
                });
              }}
              style={styles.returnButton}
            />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const filterAssignments = (assignments) => {
    if (!searchQuery.trim()) return assignments;
    const query = searchQuery.toLowerCase();
    return assignments.filter((a) => {
      const d = a.device || {};
      return (
        (d.identifier && d.identifier.toLowerCase().includes(query)) ||
        (d.make && d.make.toLowerCase().includes(query)) ||
        (d.model && d.model.toLowerCase().includes(query)) ||
        (d.serial_number && d.serial_number.toLowerCase().includes(query)) ||
        (a.user_name && a.user_name.toLowerCase().includes(query)) ||
        (a.location_name && a.location_name.toLowerCase().includes(query))
      );
    });
  };

  const filteredMyAssignments = filterAssignments(myAssignments);
  const filteredOrgAssignments = filterAssignments(organizationAssignments);

  const handleReturnDeviceModalClose = () => {
    setReturnDeviceModalVisible(false);
    setSelectedReturnLocation(null);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>Devices</Text>
        </TouchableOpacity>
        {isAdminOrOwner && (
          <Button
            title="Add Device"
            onPress={() => navigation.navigate('AddDevice')}
            size="small"
          />
        )}
      </View>

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search devices..."
      />

      {/* Tab Navigation */}
      <View style={[styles.tabContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'assignments' && [styles.activeTabButton, { borderBottomColor: colors.primary }]
          ]}
          onPress={() => setActiveTab('assignments')}
        >
          <Text style={[
            styles.tabText, { color: colors.textSecondary },
            activeTab === 'assignments' && [styles.activeTabText, { color: colors.primary }]
          ]}>
            My Assignments
          </Text>
        </TouchableOpacity>

        {isAdminOrOwner && (
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'all' && [styles.activeTabButton, { borderBottomColor: colors.primary }]
            ]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[
              styles.tabText, { color: colors.textSecondary },
              activeTab === 'all' && [styles.activeTabText, { color: colors.primary }]
            ]}>
              Organization Devices
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* My Assignments Tab Content */}
      {activeTab === 'assignments' && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            {loadingMyAssignments ? (
              <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
            ) : filteredMyAssignments.length > 0 ? (
              <View style={styles.devicesGrid}>
                {filteredMyAssignments.map(renderAssignmentCard)}
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery.trim() ? 'No matching assignments found' : 'No active device assignments found'}
              </Text>
            )}
          </View>
        </ScrollView>
      )}

      {/* All Organization Assignments Tab Content */}
      {activeTab === 'all' && isAdminOrOwner && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            {loadingOrgAssignments ? (
              <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
            ) : filteredOrgAssignments.length > 0 ? (
              <View style={styles.devicesGrid}>
                {filteredOrgAssignments.map(renderOrgAssignmentCard)}
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery.trim() ? 'No matching assignments found' : 'No organization assignments found'}
              </Text>
            )}
          </View>
        </ScrollView>
      )}

      {/* Return Device Modal */}
      <Modal
        visible={returnDeviceModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleReturnDeviceModalClose}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            onPress={handleReturnDeviceModalClose}
            activeOpacity={1}
          />
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            {selectedReturnDevice && selectedReturnDevice.device && (
              <View style={styles.modalContent}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Return Device</Text>
                  <TouchableOpacity onPress={handleReturnDeviceModalClose}>
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.modalText, { color: colors.textSecondary }]}>
                  Returning: <Text style={[styles.modalTextBold, { color: colors.textPrimary }]}>{selectedReturnDevice.device.identifier}</Text>
                </Text>
                <Text style={[styles.modalText, { color: colors.textSecondary }]}>
                  Type: <Text style={[styles.modalTextBold, { color: colors.textPrimary }]}>{selectedReturnDevice.device.device_type}</Text>
                </Text>

                <Text style={[styles.modalSectionTitle, { color: colors.textSecondary }]}>Select Return Location:</Text>

                <FlatList
                  data={locations}
                  keyExtractor={(item) => item.id.toString()}
                  style={styles.locationList}
                  renderItem={({ item }) => {
                    const isSelected = selectedReturnLocation?.id === item.id;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.locationListItem,
                          isSelected && [styles.locationListItemSelected, { backgroundColor: colors.primaryTint10 }],
                        ]}
                        onPress={() => setSelectedReturnLocation(item)}
                      >
                        <View style={styles.locationListItemContent}>
                          <Ionicons
                            name="location-outline"
                            size={20}
                            color={isSelected ? colors.primary : colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.locationListItemText, { color: colors.textPrimary },
                              isSelected && [styles.locationListItemTextSelected, { color: colors.primary }],
                            ]}
                          >
                            {item.name || `${item.street_number} ${item.street_name}`}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark" size={22} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <Text style={[styles.emptyListText, { color: colors.textMuted }]}>No locations available</Text>
                  }
                  ItemSeparatorComponent={() => <View style={[styles.listSeparator, { backgroundColor: colors.border }]} />}
                />

                <View style={styles.modalButtons}>
                  <Button
                    title="Cancel"
                    onPress={handleReturnDeviceModalClose}
                    variant="outlined"
                    style={styles.cancelButton}
                  />
                  <Button
                    title="Confirm Return"
                    onPress={handleConfirmReturn}
                    style={styles.confirmButton}
                    disabled={!selectedReturnLocation}
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
},
  backButton: {
    flexDirection: 'row',
    alignItems: 'center'
},
  backText: {
    fontSize: 17,
    color: '#E5AE18', // Updated to orange
    marginLeft: 4
},
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
},
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent'
},
  activeTabButton: {
    borderBottomColor: '#E5AE18', // Updated to orange
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666'
},
  activeTabText: {
    color: '#E5AE18', // Updated to orange
    fontWeight: '600'
},
  scrollView: {
    flex: 1
},
  scrollContent: {
    padding: 15
},
  section: {
    flex: 1
},
  devicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
},
  
  deviceCard: {
    marginBottom: 15
},
  loader: {
    marginTop: 20,
    color: '#E5AE18', // Orange loader
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 20
},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
},
  modalOverlayTouchable: {
    flex: 1
},
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '80%'
},
  modalContent: {
    paddingHorizontal: 20
},
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA'
},
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
},
  modalText: {
    fontSize: 16,
    marginBottom: 10,
    marginTop: 12,
    color: '#555',
    lineHeight: 22,
    paddingHorizontal: 20
},
  modalTextBold: {
    fontWeight: 'bold',
    color: '#333'
},
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 20
},
  locationList: {
    maxHeight: 250,
    marginHorizontal: 20
},
  locationListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4
},
  locationListItemSelected: {
    backgroundColor: '#FFF5E6',
    marginHorizontal: -4,
    paddingHorizontal: 8,
    borderRadius: 8
},
  locationListItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
},
  locationListItemText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    flex: 1
},
  locationListItemTextSelected: {
    color: ORANGE_COLOR,
    fontWeight: '600'
},
  emptyListText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 20,
    fontSize: 14
},
  listSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5EA'
},
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    paddingHorizontal: 20
},
  confirmButton: {
    flex: 1,
    backgroundColor: ORANGE_COLOR,
    borderColor: ORANGE_COLOR
},
  cancelButton: {
    flex: 1,
    borderColor: ORANGE_COLOR
}
});

export default AllDevicesScreen;