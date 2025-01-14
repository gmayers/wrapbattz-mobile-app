// HomeScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';

import Button from '../components/Button';
import Card from '../components/Card';
import { AddDeviceForm, DeviceDetailsView } from '../components/components/ModalComponents';
import CustomModal from '../components/Modal';

const MOCK_DEVICES = [
  {
    id: 1,
    identifier: 'DRL-2000',
    name: 'Drill XR-2000',
    type: 'Power Tool',
    description: 'Heavy duty drill for construction work',
    make: 'DeWalt',
    model: 'XR-2000',
    device_type: 'Drill',
    serial_number: 'DW123456',
    maintenance_interval: 90,
    next_maintenance: '2024-04-14',
    assignedDate: '2024-01-10',
    location: 'Workshop A',
    status: 'active',
  },
  {
    id: 2,
    identifier: 'BAT-V12',
    name: 'Battery Pack V12',
    type: 'Battery',
    description: '12V battery pack for power tools',
    make: 'DeWalt',
    model: 'V12',
    device_type: 'Battery',
    serial_number: 'BAT789012',
    maintenance_interval: 180,
    next_maintenance: '2024-07-12',
    assignedDate: '2024-01-12',
    location: 'Main Storage',
    status: 'active',
  },
];

const HomeScreen = ({ navigation }) => {
  const [addDeviceModalVisible, setAddDeviceModalVisible] = useState(false);
  const [assignDeviceModalVisible, setAssignDeviceModalVisible] = useState(false);
  const [deviceDetailsModalVisible, setDeviceDetailsModalVisible] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);

  const handleAddDevice = (deviceData) => {
    console.log('Adding device:', deviceData);
    Alert.alert(
      'Success',
      'Device added successfully',
      [{ text: 'OK', onPress: () => setAddDeviceModalVisible(false) }]
    );
  };

  const handleDevicePress = (device) => {
    setSelectedDevice(device);
    setDeviceDetailsModalVisible(true);
  };

  const handleDeviceReturn = (device) => {
    setSelectedDevice(device);
    setDeviceDetailsModalVisible(true);
  };

  const renderDeviceCard = (device) => (
    <Card
      key={device.id}
      title={device.name}
      subtitle={device.type}
      onPress={() => handleDevicePress(device)}
      style={styles.deviceCard}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardInfo}>
          <Text style={styles.infoText}>Assigned: {device.assignedDate}</Text>
          <Text style={styles.infoText}>Location: {device.location}</Text>
          <Text style={styles.infoText}>Status: {device.status}</Text>
        </View>
        <View style={styles.cardActions}>
          <Button
            title="Return"
            variant="outlined"
            size="small"
            onPress={() => handleDeviceReturn(device)}
          />
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>
          Welcome{'\n'}User
        </Text>
        <View style={styles.buttonContainer}>
          <Button
            title="Add Device"
            onPress={() => setAddDeviceModalVisible(true)}
            size="small"
            style={styles.headerButtonLeft}
          />
          <Button
            title="Assign Device"
            onPress={() => setAssignDeviceModalVisible(true)}
            size="small"
            style={styles.headerButtonRight}
          />
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Devices Assigned</Text>
          <View style={styles.devicesGrid}>
            {MOCK_DEVICES.map(renderDeviceCard)}
          </View>
          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => navigation?.navigate('AllDevices')}
          >
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => navigation?.navigate('Home')}
        >
          <Text>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => navigation?.navigate('Reports')}
        >
          <Text>Reports</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => {
            // Handle logout here
          }}
        >
          <Text>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Add Device Modal */}
      <CustomModal
        visible={addDeviceModalVisible}
        onClose={() => setAddDeviceModalVisible(false)}
        title="Add Device"
        headerStyle={styles.modalHeaderOverride}
      >
        <AddDeviceForm
          onSubmit={handleAddDevice}
          onCancel={() => setAddDeviceModalVisible(false)}
        />
      </CustomModal>

      {/* Assign Device Modal */}
      <CustomModal
        visible={assignDeviceModalVisible}
        onClose={() => setAssignDeviceModalVisible(false)}
        title="Assign Device"
        headerStyle={styles.modalHeaderOverride}
      >
        <Text>Assign Device Modal Content</Text>
        <Button
          title="Close"
          onPress={() => setAssignDeviceModalVisible(false)}
          variant="outlined"
        />
      </CustomModal>

      {/* Device Details Modal */}
      <CustomModal
        visible={deviceDetailsModalVisible}
        onClose={() => setDeviceDetailsModalVisible(false)}
        title="Device Details"
        headerStyle={styles.modalHeaderOverride}
      >
        {selectedDevice && (
          <DeviceDetailsView
            device={selectedDevice}
            onClose={() => setDeviceDetailsModalVisible(false)}
          />
        )}
      </CustomModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButtonLeft: {
    marginRight: 10,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  devicesGrid: {
    marginBottom: 15,
  },
  deviceCard: {
    marginBottom: 10,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  cardActions: {
    justifyContent: 'flex-end',
  },
  viewAllButton: {
    padding: 10,
    alignItems: 'center',
  },
  viewAllText: {
    color: '#007AFF',
    fontSize: 16,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  tabItem: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
  },
  modalHeaderOverride: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
    paddingVertical: 15,
  },
});

export default HomeScreen;