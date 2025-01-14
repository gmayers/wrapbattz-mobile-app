// screens/HomeScreen.js
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  StatusBar 
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import Card from '../components/Card';
import CustomModal from '../components/Modal';
import TabBar from '../components/TabBar';
import {
  NFCLock,
  NFCRead,
  NFCWrite,
  NFCPassword,
  NFCRemovePassword,
} from '../components/NFCComponents';

const HomeScreen = () => {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState('read');
  const [modalVisible, setModalVisible] = useState(false);

  // Function to render the active NFC component
  const renderNFCComponent = () => {
    switch (activeTab) {
      case 'read':
        return <NFCRead onRead={() => console.log('Reading NFC')} />;
      case 'write':
        return <NFCWrite onWrite={(msg) => console.log('Writing:', msg)} />;
      case 'lock':
        return <NFCLock onLock={() => console.log('Locking NFC')} />;
      case 'protect':
        return <NFCPassword onProtect={(pwd) => console.log('Protecting:', pwd)} />;
      case 'remove':
        return <NFCRemovePassword onRemove={(pwd) => console.log('Removing protection:', pwd)} />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Device Management</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Button Showcase */}
        <Card title="Button Variants">
          <Button 
            title="Primary Button" 
            onPress={() => setModalVisible(true)} 
          />
          <Button 
            title="Outlined Button" 
            variant="outlined" 
            backgroundColor="#4CAF50"
          />
          <Button 
            title="Ghost Button" 
            variant="ghost" 
            backgroundColor="#FF9800"
          />
          <Button 
            title="Loading Button" 
            loading={true} 
            backgroundColor="#9C27B0"
          />
          <Button
            title="Logout"
            onPress={logout}
            variant="outlined"
            backgroundColor="#FF3B30"
            style={styles.logoutButton}
          />
        </Card>

        {/* Card Showcase */}
        <Card
          title="Interactive Card"
          subtitle="With custom styling"
          headerContent={
            <Text style={styles.cardHeader}>Featured</Text>
          }
          footerContent={
            <Button 
              title="Learn More" 
              size="small" 
              variant="outlined"
            />
          }
          onPress={() => console.log('Card pressed')}
        >
          <Text style={styles.cardText}>
            This is an example of a card with header, footer, and interactive elements.
          </Text>
        </Card>

        {/* Active NFC Component */}
        <View style={styles.nfcContainer}>
          {renderNFCComponent()}
        </View>
      </ScrollView>

      {/* Modal */}
      <CustomModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Component Demo"
      >
        <Text style={styles.modalText}>
          This is a custom modal that can be used to display any content.
          It supports custom styling and animations.
        </Text>
        <Button 
          title="Close Modal" 
          onPress={() => setModalVisible(false)}
          variant="outlined"
          size="small"
        />
      </CustomModal>

      {/* Tab Bar */}
      <TabBar
        activeTab={activeTab}
        onTabPress={setActiveTab}
        backgroundColor="#FFFFFF"
        activeColor="#007AFF"
        showIcons={true}
        showLabels={true}
      />
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
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 15,
    paddingBottom: 100, // Extra padding for tab bar
  },
  nfcContainer: {
    marginVertical: 15,
  },
  cardHeader: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  modalText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
    lineHeight: 24,
  },
  logoutButton: {
    marginTop: 10,
  }
});

export default HomeScreen;