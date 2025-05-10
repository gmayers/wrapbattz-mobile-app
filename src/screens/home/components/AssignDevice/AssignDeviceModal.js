import React, { useState } from 'react';
import { Modal, View, Text, TouchableWithoutFeedback, StyleSheet, ScrollView, Platform } from 'react-native';
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
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header with close button */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Assign Device</Text>
            <TouchableWithoutFeedback onPress={onClose}>
              <View style={styles.closeIconContainer}>
                <Ionicons name="close" size={24} color="#333" />
              </View>
            </TouchableWithoutFeedback>
          </View>
          
          {/* Tab Bar - wrapped in a container for proper z-index handling */}
          <View style={styles.tabBarWrapper}>
            <TabBar
              tabs={[
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
              ]}
              activeTab={assignTab}
              onTabPress={handleAssignTabChange}
              backgroundColor="#F9F9F9"
              activeColor="#007AFF"
              inactiveColor="#666666"
              showIcons
              showLabels
              height={50}
              containerStyle={styles.assignTabBarContainer}
              labelStyle={styles.assignTabBarLabel}
              iconStyle={styles.assignTabBarIcon}
            />
          </View>
          
          {/* Content area with fixed height and proper scrolling */}
          <ScrollView 
            style={styles.contentScrollView}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            <View style={styles.tabContentContainer}>
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
            </View>
          </ScrollView>
          
          {/* Footer with action button */}
          <View style={styles.modalFooter}>
            <Button
              title="Close"
              onPress={onClose}
              variant="outlined"
              style={styles.closeButton}
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
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden', // Important for iOS rendering
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
    zIndex: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeIconContainer: {
    padding: 5, // Increase touch area
  },
  tabBarWrapper: {
    // Wrapper to help with iOS touch handling
    zIndex: 10,
    position: 'relative',
    backgroundColor: '#F9F9F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    // iOS-specific styling
    ...(Platform.OS === 'ios' ? {
      shadowColor: 'transparent',
      elevation: 0,
    } : {}),
  },
  assignTabBarContainer: {
    borderTopWidth: 0, // Remove duplicate border
    marginTop: 0,
    paddingTop: 5,
    paddingBottom: 5,
  },
  assignTabBarLabel: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  assignTabBarIcon: {
    marginBottom: 2,
  },
  contentScrollView: {
    flex: 1,
    // Ensure proper z-index stacking
    zIndex: 1,
  },
  contentContainer: {
    padding: 15,
    paddingBottom: 30, // Add padding at bottom for better scrolling
  },
  tabContentContainer: {
    minHeight: 200, // Ensure there's always content to scroll
  },
  modalFooter: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#fff',
    // Ensure footer is always visible
    zIndex: 10,
  },
  closeButton: {
    backgroundColor: '#dc3545',
  },
});

export default AssignDeviceModal;