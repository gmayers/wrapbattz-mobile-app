// src/screens/HomeScreen/components/ReturnDeviceModal.tsx
import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableWithoutFeedback,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Button from '../../../components/Button';
import Dropdown from '../../../components/Dropdown';

const ORANGE_COLOR = '#FF9500';

interface Device {
  id: string;
  identifier: string;
  device_type: string;
  current_assignment?: {
    id: string;
  };
}

interface LocationOption {
  label: string;
  value: string;
}

interface ReturnDeviceModalProps {
  visible: boolean;
  selectedDevice: Device | null;
  locationOptions: LocationOption[];
  selectedLocation: string;
  loading: boolean;
  onLocationChange: (value: string) => void;
  onConfirmReturn: () => void;
  onClose: () => void;
}

const ReturnDeviceModal: React.FC<ReturnDeviceModalProps> = ({
  visible,
  selectedDevice,
  locationOptions,
  selectedLocation,
  loading,
  onLocationChange,
  onConfirmReturn,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      testID="return-device-modal"
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContainer}>
              {selectedDevice && (
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Return Device</Text>
                  
                  <View style={styles.modalScrollContent}>
                    <Text style={styles.modalText} testID="device-identifier">
                      Returning: <Text style={styles.modalTextBold}>{selectedDevice.identifier}</Text>
                    </Text>
                    <Text style={styles.modalText} testID="device-type">
                      Type: <Text style={styles.modalTextBold}>{selectedDevice.device_type}</Text>
                    </Text>

                    {/* Location Dropdown */}
                    <Text style={styles.modalLabel}>Select Location:</Text>
                    <Dropdown
                      value={selectedLocation}
                      onValueChange={onLocationChange}
                      items={locationOptions}
                      placeholder="Select a location"
                      disabled={loading}
                      testID="return-location-dropdown"
                      containerStyle={styles.dropdownContainer}
                      style={styles.dropdownStyle}
                      itemStyle={styles.dropdownItemStyle}
                      labelStyle={styles.dropdownLabelStyle}
                      placeholderStyle={styles.dropdownPlaceholderStyle}
                      activeItemStyle={styles.dropdownActiveItemStyle}
                      activeLabelStyle={styles.dropdownActiveLabelStyle}
                      arrowStyle={styles.dropdownArrowStyle}
                      arrowColor="#333"
                    />
                  </View>

                  <View style={styles.modalButtonContainer}>
                    <Button
                      title={loading ? "Returning..." : "Confirm Return"}
                      onPress={onConfirmReturn}
                      disabled={loading || locationOptions.length === 0}
                      style={[styles.confirmButton, { backgroundColor: ORANGE_COLOR }]}
                      textColor="black"
                      testID="confirm-return-button"
                    />
                    <Button
                      title="Cancel"
                      onPress={onClose}
                      variant="outlined"
                      disabled={loading}
                      style={styles.cancelButton}
                      textColor="#007AFF"
                      testID="cancel-return-button"
                    />
                  </View>
                  
                  {loading && (
                    <ActivityIndicator 
                      size="large" 
                      color={ORANGE_COLOR}
                      style={styles.loader}
                      testID="return-loading-indicator"
                    />
                  )}
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
    padding: 20,
    maxHeight: '80%',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  modalScrollContent: {
    flex: 1,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 10,
    color: '#555',
  },
  modalLabel: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  modalTextBold: {
    fontWeight: 'bold',
    color: '#333',
  },
  
  // Dropdown styles
  dropdownContainer: {
    width: '100%',
    marginBottom: 15,
    minHeight: 50,
    zIndex: 1000,
  },
  dropdownStyle: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cccccc',
    minHeight: 50,
    paddingLeft: 0,
    paddingRight: 30,
    paddingVertical: 12,
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownLabelStyle: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'left',
    flexShrink: 1,
    width: '100%',
    paddingLeft: 15,
  },
  dropdownPlaceholderStyle: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'left',
    paddingLeft: 15,
  },
  dropdownItemStyle: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownActiveItemStyle: {
    backgroundColor: '#f0f8ff',
  },
  dropdownActiveLabelStyle: {
    color: ORANGE_COLOR,
    fontWeight: 'bold',
  },
  dropdownArrowStyle: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -6,
  },
  
  // Button styles
  modalButtonContainer: {
    marginTop: 15,
  },
  confirmButton: {
    marginBottom: 10,
    width: '100%',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
    width: '100%',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
  },
  loader: {
    marginTop: 10,
  },
});

export default ReturnDeviceModal;