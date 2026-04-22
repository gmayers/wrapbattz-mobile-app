// LocationDetailsScreen.js
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
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import Card from '../components/Card';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  assignments as assignmentsApi,
  sites as sitesApi,
  tools as toolsApi,
} from '../api/endpoints';
import { toLegacyAssignment, toLegacyLocation } from '../api/adapters';
import { ApiError } from '../api/errors';

// Define the orange color to be used for buttons to match LocationsScreen
const ORANGE_COLOR = '#FFC72C'; // TOOLTRAQ yellow

const LocationDetailsScreen = ({ navigation, route }) => {
  const { locationId } = route.params;
  
  const { isAdminOrOwner, userData, isLoading: authLoading } = useAuth();
  const { colors } = useTheme();

  const [location, setLocation] = useState(null);
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDevicesLoading, setIsDevicesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assigningDevice, setAssigningDevice] = useState(null);

  // Transfer to location state
  const [otherLocations, setOtherLocations] = useState([]);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [selectedDeviceForTransfer, setSelectedDeviceForTransfer] = useState(null);
  const [transferringDevice, setTransferringDevice] = useState(null);

  const siteId = Number(locationId);

  const fetchLocationDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const site = await sitesApi.getSite(siteId);
      setLocation(toLegacyLocation(site));
    } catch (error) {
      if (!(error instanceof ApiError && error.code === 'unauthorized')) {
        const errorMsg =
          (error instanceof ApiError && error.message) ||
          'Failed to fetch location details. Please try again later.';
        setError(errorMsg);
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [siteId]);

  const fetchLocationDevices = useCallback(async () => {
    setIsDevicesLoading(true);
    try {
      const page = await assignmentsApi.listAssignmentsBySite(siteId);
      const sorted = [...page.items].sort((a, b) => {
        const at = a.assigned_at ? new Date(a.assigned_at).getTime() : 0;
        const bt = b.assigned_at ? new Date(b.assigned_at).getTime() : 0;
        return bt - at;
      });
      const mapped = sorted.map((assignment) => {
        const legacy = toLegacyAssignment(assignment);
        return {
          ...legacy.device,
          assignmentId: legacy.id,
          assignedDate: legacy.assigned_date,
        };
      });
      setDevices(mapped);
    } catch (error) {
      if (!(error instanceof ApiError && error.code === 'unauthorized')) {
        const errorMsg =
          (error instanceof ApiError && error.message) ||
          'Failed to fetch location devices. Please try again later.';
        setError(errorMsg);
        Alert.alert('Error', errorMsg);
      }
      setDevices([]);
    } finally {
      setIsDevicesLoading(false);
    }
  }, [siteId]);

  const fetchOtherLocations = useCallback(async () => {
    if (!isAdminOrOwner) return;
    try {
      const page = await sitesApi.listSites();
      const filtered = page.items
        .filter((s) => s.id !== siteId)
        .map(toLegacyLocation);
      setOtherLocations(filtered);
    } catch (error) {
      // Non-critical.
    }
  }, [siteId, isAdminOrOwner]);

  // Execute fetch operations on component mount and when locationId changes
  useEffect(() => {
    fetchLocationDetails();
    fetchLocationDevices();
    fetchOtherLocations();
  }, [locationId, fetchLocationDetails, fetchLocationDevices, fetchOtherLocations]);

  // Set up the header with location name once it's loaded
  useEffect(() => {
    if (location) {
      navigation.setOptions({
        title: location.name || `${location.street_number} ${location.street_name}`,
        headerBackTitle: 'Locations',
      });
    }
  }, [location, navigation]);

  // Navigate to device details
  const handleViewDevice = useCallback((deviceId) => {
    navigation.navigate('DeviceDetails', { 
      deviceId,
      sourceScreen: 'LocationDetails'
    });
  }, [navigation]);

  // Handle direct assignment to current user
  const handleAssignDevice = useCallback(async (deviceId) => {
    setAssigningDevice(deviceId);
    try {
      await toolsApi.assignToolToMe(Number(deviceId));
      Alert.alert(
        'Success',
        'Device assigned successfully to your account.',
        [{ text: 'OK', onPress: () => { fetchLocationDevices(); } }]
      );
    } catch (error) {
      const errorMessage =
        (error instanceof ApiError && error.message) ||
        'Failed to assign device. Please try again.';
      Alert.alert('Assignment Error', errorMessage);
    } finally {
      setAssigningDevice(null);
    }
  }, [fetchLocationDevices]);

  // Open transfer modal for a device
  const openTransferModal = useCallback((device) => {
    setSelectedDeviceForTransfer(device);
    setTransferModalVisible(true);
  }, []);

  // Handle transfer to another location
  const handleTransferToLocation = useCallback(async (targetLocationId) => {
    if (!selectedDeviceForTransfer) return;

    setTransferringDevice(selectedDeviceForTransfer.id);

    try {
      await assignmentsApi.createAssignment({
        tool_id: Number(selectedDeviceForTransfer.id),
        assignee_site_id: Number(targetLocationId),
        condition: '',
        notes: '',
      });

      Alert.alert(
        'Success',
        'Device transferred successfully.',
        [{
          text: 'OK',
          onPress: () => {
            setTransferModalVisible(false);
            setSelectedDeviceForTransfer(null);
            fetchLocationDevices();
          }
        }]
      );
    } catch (error) {
      const errorMessage =
        (error instanceof ApiError && error.message) ||
        'Failed to transfer device. Please try again.';
      Alert.alert('Transfer Error', errorMessage);
    } finally {
      setTransferringDevice(null);
    }
  }, [selectedDeviceForTransfer, fetchLocationDevices]);

  // Navigate to add device screen with the location pre-selected
  const handleAddDevice = useCallback(() => {
    navigation.navigate('AddDevice', { locationId });
  }, [navigation, locationId]);

  // Handle try again
  const handleTryAgain = useCallback(() => {
    setError(null);
    fetchLocationDetails();
    fetchLocationDevices();
  }, [fetchLocationDetails, fetchLocationDevices]);

  const renderDeviceCard = useCallback((device) => {
    // Since we're only showing unassigned devices, all should be available for assignment
    const isAssigning = assigningDevice === device.id;
    
    return (
      <Card
        style={styles.deviceCard}
      >
        <View style={styles.deviceContent}>
          {/* Device Header */}
          <View style={styles.deviceHeader}>
            <View style={styles.deviceTitleContainer}>
              <Text style={styles.deviceTitle}>{device.identifier}</Text>
              <Text style={styles.deviceType}>{device.device_type}</Text>
            </View>
            <View style={styles.statusContainer}>
              <View style={[styles.statusBadge, { backgroundColor: '#10B981' }]}>
                <Text style={styles.statusText}>Available</Text>
              </View>
            </View>
          </View>
          
          {/* Device Details */}
          <View style={styles.deviceDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Make:</Text>
              <Text style={styles.detailValue}>{device.make || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Model:</Text>
              <Text style={styles.detailValue}>{device.model || 'N/A'}</Text>
            </View>
            {device.serial_number && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Serial:</Text>
                <Text style={styles.detailValue}>{device.serial_number}</Text>
              </View>
            )}
            {device.description && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Description:</Text>
                <Text style={styles.detailValue}>{device.description}</Text>
              </View>
            )}
          </View>
          
          {/* Action Buttons */}
          <View style={styles.deviceActions}>
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => handleViewDevice(device.id)}
            >
              <Ionicons name="eye-outline" size={18} color={colors.primary} />
              <Text style={styles.viewButtonText}>View Details</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.assignButton, isAssigning && styles.assignButtonDisabled]}
              onPress={() => handleAssignDevice(device.id)}
              disabled={isAssigning}
            >
              <Ionicons
                name={isAssigning ? "hourglass-outline" : "person-add-outline"}
                size={18}
                color="#0F1722"
              />
              <Text style={styles.assignButtonText}>
                {isAssigning ? 'Assigning...' : 'Assign to Me'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Transfer Button - Admin/Owner only */}
          {isAdminOrOwner && otherLocations.length > 0 && (
            <TouchableOpacity
              style={styles.transferButton}
              onPress={() => openTransferModal(device)}
            >
              <Ionicons name="swap-horizontal-outline" size={18} color={colors.primary} />
              <Text style={styles.transferButtonText}>Transfer to Location</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  }, [handleViewDevice, handleAssignDevice, assigningDevice, isAdminOrOwner, otherLocations, openTransferModal]);

  const renderAddressDetails = useCallback(() => {
    if (!location) return null;
    
    return (
      <Card title="Location Details" style={styles.addressCard}>
        <View style={styles.addressContent}>
          {location.name && (
            <Text style={styles.addressText}>{location.name}</Text>
          )}
          <Text style={styles.addressText}>
            {location.street_number} {location.street_name}
          </Text>
          {location.address_2 && (
            <Text style={styles.addressText}>{location.address_2}</Text>
          )}
          <Text style={styles.addressText}>
            {location.town_or_city}{location.county ? `, ${location.county}` : ''}
          </Text>
          <Text style={styles.addressText}>{location.postcode}</Text>
          
          {userData?.name && (
            <View style={styles.organizationInfo}>
              <Text style={styles.organizationText}>
                Organization: {userData.name}'s Organization
              </Text>
            </View>
          )}
        </View>
      </Card>
    );
  }, [location, userData]);

  // Check for auth errors
  if (authError) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorMessage}>{authError}</Text>
        <Button
          title="Try Again"
          onPress={() => {
            clearError();
            handleTryAgain();
          }}
          size="medium"
        />
      </SafeAreaView>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading location details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state if location fetch failed
  if (error && !location) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={styles.errorMessage}>{error}</Text>
        <Button
          title="Try Again"
          onPress={handleTryAgain}
          size="medium"
          style={{ marginTop: 15 }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
      >
        {renderAddressDetails()}
        
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available Devices</Text>
            {isAdminOrOwner && (
              <Button
                title="Add New Device"
                onPress={handleAddDevice}
                size="small"
              />
            )}
          </View>
          
          {isDevicesLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : devices.length > 0 ? (
            <>
              {devices.map((device) => (
                <View key={device.assignmentId || `device-${device.id}`}>
                  {renderDeviceCard(device)}
                </View>
              ))}
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={48} color={colors.disabled} />
              <Text style={styles.emptyText}>No available devices at this location</Text>
              <Text style={styles.emptySubtext}>All devices are either assigned to users or located elsewhere</Text>
              {isAdminOrOwner && (
                <Button
                  title="Add New Device"
                  onPress={handleAddDevice}
                  size="small"
                  style={{ marginTop: 15 }}
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Transfer to Location Modal */}
      <Modal
        visible={transferModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setTransferModalVisible(false);
          setSelectedDeviceForTransfer(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Transfer Device</Text>
              <TouchableOpacity
                onPress={() => {
                  setTransferModalVisible(false);
                  setSelectedDeviceForTransfer(null);
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedDeviceForTransfer && (
              <Text style={styles.modalSubtitle}>
                Transfer {selectedDeviceForTransfer.identifier} to another location
              </Text>
            )}

            <Text style={styles.selectLabel}>Select Destination Location:</Text>

            <FlatList
              data={otherLocations}
              keyExtractor={(item) => item.id.toString()}
              style={styles.locationList}
              renderItem={({ item }) => {
                const isTransferring = transferringDevice === selectedDeviceForTransfer?.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.locationItem,
                      isTransferring && styles.locationItemDisabled
                    ]}
                    onPress={() => handleTransferToLocation(item.id)}
                    disabled={isTransferring}
                  >
                    <View style={styles.locationItemContent}>
                      <Ionicons name="location-outline" size={20} color={colors.primary} />
                      <View style={styles.locationItemText}>
                        <Text style={styles.locationItemName}>
                          {item.name || `${item.street_number} ${item.street_name}`}
                        </Text>
                        <Text style={styles.locationItemAddress}>
                          {item.town_or_city}, {item.postcode}
                        </Text>
                      </View>
                    </View>
                    {isTransferring ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color={colors.disabled} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.noLocationsText}>No other locations available</Text>
              }
            />

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setTransferModalVisible(false);
                setSelectedDeviceForTransfer(null);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 15,
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  addressContent: {
    padding: 15,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  organizationInfo: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  organizationText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  deviceCard: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  deviceContent: {
    padding: 20,
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  deviceTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  deviceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  deviceType: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  deviceDetails: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    width: 80,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  deviceActions: {
    flexDirection: 'row',
    gap: 12,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: ORANGE_COLOR,
    backgroundColor: 'transparent',
  },
  viewButtonText: {
    marginLeft: 8,
    color: ORANGE_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
  assignButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: ORANGE_COLOR,
    shadowColor: ORANGE_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  assignButtonDisabled: {
    backgroundColor: '#CCC',
    shadowOpacity: 0,
    elevation: 0,
  },
  assignButtonText: {
    marginLeft: 8,
    color: '#0F1722',
    fontSize: 14,
    fontWeight: '600',
  },
  loader: {
    marginVertical: 20,
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
  emptySubtext: {
    textAlign: 'center',
    fontSize: 14,
    color: '#999',
    marginTop: 5,
    fontStyle: 'italic',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  errorMessage: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  // Transfer button styles
  transferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: ORANGE_COLOR,
    backgroundColor: 'transparent',
    marginTop: 12,
  },
  transferButtonText: {
    marginLeft: 8,
    color: ORANGE_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  selectLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 10,
  },
  locationList: {
    maxHeight: 300,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  locationItemDisabled: {
    opacity: 0.5,
  },
  locationItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationItemText: {
    marginLeft: 12,
    flex: 1,
  },
  locationItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  locationItemAddress: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  noLocationsText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 20,
    fontSize: 14,
  },
  cancelButton: {
    marginTop: 15,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
});

export default LocationDetailsScreen;