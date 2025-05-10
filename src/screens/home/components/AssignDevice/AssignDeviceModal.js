import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
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

  const handleAssignTabChange = (tabKey) => {
    console.log('Tab changed to:', tabKey);
    setAssignTab(tabKey);
  };

  // Tab configuration
  const tabs = [
    {
      key: 'nfcScan',
      title: 'NFC Scan',
      icon: <Ionicons 
        name="scan-outline" 
        size={20} 
        color={assignTab === 'nfcScan' ? '#007AFF' : '#666666'} 
      />,
    },
    {
      key: 'selectMenu',
      title: 'Select Menu',
      icon: <Ionicons 
        name="list-outline" 
        size={20} 
        color={assignTab === 'selectMenu' ? '#007AFF' : '#666666'} 
      />,
    },
  ];

  // Render the appropriate content based on the selected tab
  const renderTabContent = () => {
    switch (assignTab) {
      case 'nfcScan':
        return (
          <View style={styles.nfcScanContainer}>
            <NFCScanTab onAssignComplete={onAssignComplete} />
          </View>
        );
      case 'selectMenu':
        return (
          <View style={styles.selectMenuContainer}>
            <SelectMenuTab
              locations={locations}
              onAssignComplete={onAssignComplete}
              fetchDevicesByLocation={fetchDevicesByLocation}
              handleApiError={handleApiError}
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header with improved close button */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Assign Device</Text>
            <TouchableOpacity 
              onPress={onClose}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            >
              <Ionicons name="close-outline" size={28} color="#666" />
            </TouchableOpacity>
          </View>
          
          {/* Tab Navigation Bar */}
          <View style={styles.tabBarContainer}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabButton,
                  assignTab === tab.key && styles.activeTabButton
                ]}
                onPress={() => handleAssignTabChange(tab.key)}
                activeOpacity={0.7}
              >
                <View style={styles.tabButtonContent}>
                  {React.cloneElement(tab.icon)}
                  <Text
                    style={[
                      styles.tabButtonText,
                      assignTab === tab.key && styles.activeTabButtonText
                    ]}
                  >
                    {tab.title}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Tab Content */}
          <View style={styles.tabContentContainer}>
            {renderTabContent()}
          </View>
          
          {/* Footer with action button */}
          <View style={styles.modalFooter}>
            <Button
              title="Close"
              onPress={onClose}
              style={styles.closeButton}
              textColor="white"
            />
          </View>
        </View>
      </View>
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
    height: '80%',
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  // Custom tab bar styling
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#F9F9F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 5,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonText: {
    fontSize: 12,
    marginTop: 4,
    color: '#666666',
    fontWeight: '500',
  },
  activeTabButtonText: {
    color: '#007AFF',
  },
  // Content container
  // Content container
  tabContentContainer: {
    flex: 1,
    padding: 0, // Remove padding here, let child components handle their own padding
    backgroundColor: '#fff',
  },
  nfcScanContainer: {
    flex: 1,
    justifyContent: 'center', // Center NFC scan content vertically
    alignItems: 'center', // Center horizontally too
    padding: 15,
  },
  selectMenuContainer: {
    flex: 1,
    padding: 15,
  },
  modalFooter: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  closeButton: {
    backgroundColor: '#FF9800', // Orange instead of red
  },
});

export default AssignDeviceModal;