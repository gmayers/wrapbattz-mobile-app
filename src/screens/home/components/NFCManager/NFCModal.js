// NFCModal.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TabBar from '../../../../components/TabBar';
import NFCActions from './NFCActions';
import Button from '../../../../components/Button';

const NFCModal = ({
  visible,
  onClose,
  onSuccess,
}) => {
  // State
  const [activeTab, setActiveTab] = useState('read');

  // Reset active tab when modal closes
  useEffect(() => {
    if (!visible) {
      setActiveTab('read');
    }
  }, [visible]);

  // Tab configuration
  const tabs = [
    {
      key: 'read',
      title: 'Read',
      icon: <Ionicons name="scan-outline" size={20} />,
    },
    {
      key: 'write',
      title: 'Write',
      icon: <Ionicons name="create-outline" size={20} />,
    },
    {
      key: 'lock',
      title: 'Lock',
      icon: <Ionicons name="lock-closed-outline" size={20} />,
    },
    {
      key: 'unlock',
      title: 'Unlock',
      icon: <Ionicons name="lock-open-outline" size={20} />,
    },
  ];

  // Handle tab change
  const handleTabPress = (tabKey) => {
    setActiveTab(tabKey);
  };

  // Handle success callback
  const handleSuccess = () => {
    onSuccess?.();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContainer}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>NFC Manager</Text>
                <Button
                  variant="text"
                  onPress={onClose}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#333" />
                </Button>
              </View>

              {/* Tab Navigation */}
              <TabBar
                tabs={tabs}
                activeTab={activeTab}
                onTabPress={handleTabPress}
                backgroundColor="#F9F9F9"
                activeColor="#007AFF"
                inactiveColor="#666666"
                showIcons
                showLabels
                height={50}
                containerStyle={styles.tabBarContainer}
              />

              {/* Content Area */}
              <ScrollView 
                style={styles.contentContainer}
                contentContainerStyle={styles.contentContainerStyle}
                showsVerticalScrollIndicator={false}
              >
                <NFCActions
                  activeTab={activeTab}
                  onClose={onClose}
                  onSuccess={handleSuccess}
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
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  tabBarContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
  },
  contentContainerStyle: {
    flexGrow: 1,
  },
});

export default NFCModal;