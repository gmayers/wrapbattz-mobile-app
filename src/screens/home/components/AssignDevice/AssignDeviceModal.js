import React, { useState } from 'react';
import { Modal, View, Text, TouchableWithoutFeedback, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TabBar from '../../../../components/TabBar';
import NFCScanTab from './NFCScanTab';
import SelectMenuTab from './SelectMenuTab';
import Button from '../../../../components/Button';

const AssignDeviceModal = ({
  visible,
  onClose,
  locations,
  fetchDevicesByLocation,
  onAssignComplete,
  handleApiError
}) => {
  const [assignTab, setAssignTab] = useState('nfcScan');

  const handleAssignTabChange = (key) => {
    setAssignTab(key);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContainer}>
              <ScrollView contentContainerStyle={[styles.modalContent, { paddingBottom: 60 }]}>
                <Text style={styles.modalTitle}>Assign Device</Text>
                
                <TabBar
                  tabs={[
                    {
                      key: 'nfcScan',
                      title: <Text>NFC Scan</Text>,
                      icon: <Ionicons name="scan-outline" size={20} />,
                    },
                    {
                      key: 'selectMenu',
                      title: <Text>Select Menu</Text>,
                      icon: <Ionicons name="list-outline" size={20} />,
                    },
                  ]}
                  activeTab={assignTab}
                  onTabPress={handleAssignTabChange}
                  backgroundColor="#F9F9F9"
                  activeColor="#007AFF"
                  inactiveColor="#666666"
                  showIcons
                  showLabels
                  height={50}
                  containerStyle={[styles.assignTabBarContainer, { marginBottom: 15 }]}
                  labelStyle={styles.assignTabBarLabel}
                  iconStyle={styles.assignTabBarIcon}
                />
                
                {assignTab === 'nfcScan' && (
                  <NFCScanTab onAssignComplete={onAssignComplete} />
                )}
                
                {assignTab === 'selectMenu' && (
                  <SelectMenuTab
                    locations={locations}
                    onAssignComplete={onAssignComplete}
                    fetchDevicesByLocation={fetchDevicesByLocation}
                    handleApiError={handleApiError}
                  />
                )}

                <Button
                  title="Close"
                  onPress={onClose}
                  variant="outlined"
                  style={styles.closeButton}
                />
              </ScrollView>
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
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
  },
  modalContent: {
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  assignTabBarContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: '2%',
  },
  assignTabBarLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  assignTabBarIcon: {
    fontSize: 20,
  },
  closeButton: {
    backgroundColor: '#dc3545',
    marginTop: 20,
  },
});

export default AssignDeviceModal;