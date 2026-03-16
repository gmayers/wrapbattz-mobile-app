import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TabBar from '../../../../components/TabBar';
import NFCScanTab from './NFCScanTab';
import SelectMenuTab from './SelectMenuTab';
import Button from '../../../../components/Button';
import { useTheme } from '../../../../context/ThemeContext';

const AssignDeviceModal = ({
  visible,
  onClose,
  locations,
  fetchDevicesByLocation,
  onAssignComplete,
  handleApiError
}) => {
  const { colors } = useTheme();
  const styles = getAssignStyles(colors);
  const [assignTab, setAssignTab] = useState('nfcScan');

  const handleAssignTabChange = (tabKey) => {
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
        color={assignTab === 'nfcScan' ? colors.primary : colors.textSecondary}
      />,
    },
    {
      key: 'selectMenu',
      title: 'Select Menu',
      icon: <Ionicons
        name="list-outline"
        size={20}
        color={assignTab === 'selectMenu' ? colors.primary : colors.textSecondary}
      />,
    },
  ];

  // Render the appropriate content based on the selected tab
  const renderTabContent = () => {
    switch (assignTab) {
      case 'nfcScan':
        return (
          <View style={styles.nfcScanContainer}>
            <NFCScanTab 
              onAssignComplete={onAssignComplete} 
              handleApiError={handleApiError}
            />
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
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalContainer}>
            {/* Header with improved close button */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Device</Text>
              <TouchableOpacity 
                onPress={onClose}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              >
                <Ionicons name="close-outline" size={28} color={colors.textSecondary} />
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
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const getAssignStyles = (colors) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSafeArea: {
    width: '90%',
    maxHeight: '80%',
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderRadius: 10,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    borderBottomColor: colors.primary,
  },
  tabButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonText: {
    fontSize: 12,
    marginTop: 4,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  activeTabButtonText: {
    color: colors.primary,
  },
  tabContentContainer: {
    flex: 1,
    padding: 0,
    backgroundColor: colors.card,
  },
  nfcScanContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
  },
  selectMenuContainer: {
    flex: 1,
    padding: 15,
  },
  modalFooter: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  closeButton: {
    backgroundColor: colors.primary,
  },
});

export default AssignDeviceModal;