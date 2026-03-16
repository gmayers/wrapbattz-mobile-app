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
import { useTheme } from '../../../context/ThemeContext';

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
  const { colors } = useTheme();

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
            <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
              {selectedDevice && (
                <View style={styles.modalContent}>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Return Device</Text>
                  
                  <View style={styles.modalScrollContent}>
                    <Text style={[styles.modalText, { color: colors.textSecondary }]} testID="device-identifier">
                      Returning: <Text style={[styles.modalTextBold, { color: colors.textPrimary }]}>{selectedDevice.identifier}</Text>
                    </Text>
                    <Text style={[styles.modalText, { color: colors.textSecondary }]} testID="device-type">
                      Type: <Text style={[styles.modalTextBold, { color: colors.textPrimary }]}>{selectedDevice.device_type}</Text>
                    </Text>

                    {/* Location Dropdown */}
                    <Text style={[styles.modalLabel, { color: colors.textPrimary }]}>Select Location:</Text>
                    <Dropdown
                      value={selectedLocation}
                      onValueChange={onLocationChange}
                      items={locationOptions}
                      placeholder="Select a location"
                      disabled={loading}
                      testID="return-location-dropdown"
                      containerStyle={styles.dropdownContainer}
                      style={[styles.dropdownStyle, { backgroundColor: colors.surface, borderColor: colors.borderInput }]}
                      itemStyle={[styles.dropdownItemStyle, { borderBottomColor: colors.borderLight }]}
                      labelStyle={[styles.dropdownLabelStyle, { color: colors.textPrimary }]}
                      placeholderStyle={[styles.dropdownPlaceholderStyle, { color: colors.textMuted }]}
                      activeItemStyle={[styles.dropdownActiveItemStyle, { backgroundColor: colors.primaryTint10 }]}
                      activeLabelStyle={[styles.dropdownActiveLabelStyle, { color: colors.primary }]}
                      arrowStyle={styles.dropdownArrowStyle}
                      arrowColor={colors.textPrimary}
                    />
                  </View>

                  <View style={styles.modalButtonContainer}>
                    <Button
                      title={loading ? "Returning..." : "Confirm Return"}
                      onPress={onConfirmReturn}
                      disabled={loading || locationOptions.length === 0}
                      style={[styles.confirmButton, { backgroundColor: colors.primary }]}
                      textColor="black"
                      testID="confirm-return-button"
                    />
                    <Button
                      title="Cancel"
                      onPress={onClose}
                      variant="outlined"
                      disabled={loading}
                      style={[styles.cancelButton, { backgroundColor: colors.surfaceAlt }]}
                      textColor={colors.textSecondary}
                      testID="cancel-return-button"
                    />
                  </View>
                  
                  {loading && (
                    <ActivityIndicator 
                      size="large" 
                      color={colors.primary}
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
    marginBottom: 15,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 10,
  },
  modalLabel: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 10,
  },
  modalTextBold: {
    fontWeight: 'bold',
  },
  
  // Dropdown styles
  dropdownContainer: {
    width: '100%',
    marginBottom: 15,
    minHeight: 50,
    zIndex: 1000,
  },
  dropdownStyle: {
    borderRadius: 8,
    borderWidth: 1,
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
    textAlign: 'left',
    flexShrink: 1,
    width: '100%',
    paddingLeft: 15,
  },
  dropdownPlaceholderStyle: {
    fontSize: 16,
    textAlign: 'left',
    paddingLeft: 15,
  },
  dropdownItemStyle: {
    padding: 15,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownActiveItemStyle: {
  },
  dropdownActiveLabelStyle: {
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
    backgroundColor: undefined,
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