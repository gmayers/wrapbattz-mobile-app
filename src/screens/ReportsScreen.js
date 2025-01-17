// ReportsScreen.js
import React, { useState, useEffect } from 'react';
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
  Dimensions,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import Card from '../components/Card';
import TabBar from '../components/TabBar';
import CustomModal from '../components/Modal';
import { BaseTextInput } from '../components/TextInput';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

// Type definitions with tooltips
const REPORT_TYPES = {
  DAMAGED: "Device is physically damaged or broken",
  STOLEN: "Device has been stolen or is missing under suspicious circumstances",
  LOST: "Device cannot be located but no suspicion of theft",
  MALFUNCTIONING: "Device is not working correctly but shows no physical damage",
  MAINTENANCE: "Device needs routine maintenance or inspection",
  OTHER: "Other issues not covered by other categories"
};

// Report Form Component
const ReportForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    device_id: '',
    type: '',
    description: '',
    photo: null
  });
  const [photoUri, setPhotoUri] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        setPhotoUri(result.assets[0].uri);
        setFormData(prev => ({ ...prev, photo: result.assets[0].uri }));
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const validateForm = () => {
    if (!formData.device_id) {
      Alert.alert('Error', 'Please select a device');
      return false;
    }
    if (!formData.type) {
      Alert.alert('Error', 'Please select a report type');
      return false;
    }
    if (!formData.description) {
      Alert.alert('Error', 'Please enter a description');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      
      const reportResponse = await fetch('https://test.gmayersservices.com/api/reports/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          status: 'OPEN',
          report_date: new Date().toISOString().split('T')[0],
        }),
      });

      if (!reportResponse.ok) {
        throw new Error(`Failed to create report: ${reportResponse.status}`);
      }

      const reportData = await reportResponse.json();

      if (photoUri) {
        const photoForm = new FormData();
        photoForm.append('image', {
          uri: photoUri,
          type: 'image/jpeg',
          name: 'photo.jpg',
        });
        photoForm.append('device', formData.device_id);
        photoForm.append('report', reportData.id);

        const photoResponse = await fetch('https://test.gmayersservices.com/api/device-photos/', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
          body: photoForm,
        });

        if (!photoResponse.ok) {
          console.warn('Failed to upload photo, but report was created');
        }
      }

      onSubmit();
      Alert.alert('Success', 'Report submitted successfully');
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  const renderTypeButton = (type, description) => (
    <TouchableOpacity
      key={type}
      style={[
        styles.typeButtonGrid,
        formData.type === type && styles.typeButtonSelected
      ]}
      onPress={() => {
        setFormData(prev => ({ ...prev, type }));
        Alert.alert(type, description);
      }}
    >
      <Text style={[
        styles.typeButtonText,
        formData.type === type && styles.typeButtonTextSelected
      ]} numberOfLines={2}>
        {type}
      </Text>
      <Ionicons 
        name="information-circle-outline" 
        size={18} 
        color={formData.type === type ? '#007AFF' : '#666'}
        style={styles.typeButtonIcon}
      />
    </TouchableOpacity>
  );
  return (
    <ScrollView style={styles.formContainer}>
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Device</Text>
        {/* Device dropdown component will go here */}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Report Type</Text>
        <View style={styles.typeGrid}>
          {Object.entries(REPORT_TYPES).map(([type, description], index) => (
            <View key={type} style={styles.typeGridItem}>
              {renderTypeButton(type, description)}
            </View>
          ))}
        </View>
      </View>

      <BaseTextInput
        label="Description"
        value={formData.description}
        onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
        placeholder="Enter description"
        multiline
        numberOfLines={4}
        style={styles.formInput}
      />

      <View style={styles.photoSection}>
        <Button
          title="Add Photo"
          onPress={pickImage}
          variant="outlined"
          size="small"
        />
        {photoUri && (
          <Image source={{ uri: photoUri }} style={styles.previewImage} />
        )}
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Cancel"
          onPress={onCancel}
          variant="outlined"
          style={styles.buttonMargin}
          disabled={isSubmitting}
        />
        <Button
          title={isSubmitting ? "Submitting..." : "Submit"}
          onPress={handleSubmit}
          disabled={isSubmitting}
        />
      </View>
    </ScrollView>
  );
};

// Main ReportsScreen Component
const ReportsScreen = ({ navigation }) => {
  const { logout, refreshToken, getAccessToken } = useAuth();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('reports');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      let token = await getAccessToken();
      
      let response = await fetch('https://test.gmayersservices.com/api/reports/', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });
      
      if (response.status === 401) {
        token = await refreshToken();
        response = await fetch('https://test.gmayersservices.com/api/reports/', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (Array.isArray(data)) {
        setReports(data.slice(0, 5));
      } else if (data && data.results && Array.isArray(data.results)) {
        setReports(data.results.slice(0, 5));
      } else {
        console.error('Unexpected data format:', data);
        setReports([]);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      if (error.message.includes('401')) {
        Alert.alert('Session Expired', 'Please login again');
        logout();
      } else {
        Alert.alert('Error', 'Failed to fetch reports. Please try again later.');
      }
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabPress = (key) => {
    setActiveTab(key);
    switch (key) {
      case 'dashboard':
        navigation.navigate('Dashboard');
        break;
      case 'logout':
        Alert.alert(
          'Logout',
          'Are you sure you want to logout?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Logout', 
              style: 'destructive',
              onPress: () => logout()
            }
          ]
        );
        break;
    }
  };

  const tabs = [
    {
      key: 'dashboard',
      title: 'Home',
      icon: <Ionicons name="home-outline" size={24} />,
    },
    {
      key: 'reports',
      title: 'Reports',
      icon: <Ionicons name="document-text-outline" size={24} />,
    },
    {
      key: 'logout',
      title: 'Logout',
      icon: <Ionicons name="log-out-outline" size={24} />,
    }
  ];

  const renderReportCard = (report) => (
    <Card
      key={report.id}
      title={`Device: ${report.device?.identifier || 'Unknown'}`}
      style={styles.reportCard}
    >
      <View style={styles.reportContent}>
        <Text style={styles.reportText}>Date: {report.report_date}</Text>
        <TouchableOpacity 
          onPress={() => Alert.alert('Type Info', REPORT_TYPES[report.type])}
          style={styles.typeRow}
        >
          <Text style={styles.reportText}>Type: {report.type}</Text>
          <Ionicons name="information-circle-outline" size={16} color="#666" />
        </TouchableOpacity>
        <Text style={styles.reportText}>Status: {report.status}</Text>
        <Text style={styles.reportText}>Resolved: {report.resolved ? 'Yes' : 'No'}</Text>
        {report.resolved_date && (
          <Text style={styles.reportText}>Resolved Date: {report.resolved_date}</Text>
        )}
        <Text style={styles.reportText}>Description: {report.description}</Text>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <Button
          title="Create Report"
          onPress={() => setCreateModalVisible(true)}
          size="small"
        />
      </View>

      <View style={styles.contentContainer}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
        >
          <View style={styles.section}>
            {isLoading ? (
              <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
            ) : reports.length > 0 ? (
              <>
                {reports.map(renderReportCard)}
                <TouchableOpacity
                  style={styles.viewAllButton}
                  onPress={() => navigation?.navigate('AllReports')}
                >
                  <Text style={styles.viewAllText}>All Reports</Text>
                  <Ionicons name="chevron-forward" size={16} color="#007AFF" />
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.emptyText}>No reports found</Text>
            )}
          </View>
        </ScrollView>
      </View>

      <CustomModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        title="Create Report"
        headerStyle={styles.modalHeaderOverride}
      >
        <ReportForm
          onSubmit={() => {
            setCreateModalVisible(false);
            fetchReports();
          }}
          onCancel={() => setCreateModalVisible(false)}
        />
      </CustomModal>

      <TabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabPress={handleTabPress}
        backgroundColor="#FFFFFF"
        activeColor="#007AFF"
        inactiveColor="#666666"
        showIcons={true}
        showLabels={true}
        height={Platform.OS === 'ios' ? 80 : 60}
        containerStyle={styles.tabBarContainer}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    // Container and Layout Styles
    container: {
      flex: 1,
      backgroundColor: '#F5F5F5',
    },
    contentContainer: {
      flex: 1,
      position: 'relative',
    },
    header: {
      padding: 15,
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: '#E0E0E0',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    scrollView: {
      flex: 1,
    },
    scrollViewContent: {
      flexGrow: 1,
    },
    section: {
      padding: 15,
      paddingBottom: Platform.OS === 'ios' ? 100 : 80,
    },
   
    // Report Card Styles
    reportCard: {
      marginBottom: 10,
      backgroundColor: '#FFFFFF',
      borderRadius: 8,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3,
    },
    reportContent: {
      gap: 4,
      padding: 15,
      flex: 0.8,
    },
    reportText: {
      fontSize: 14,
      color: '#666',
      lineHeight: 20,
    },
    typeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
   
    // View All Button Styles
    viewAllButton: {
      flex: 0.2,
      padding: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },
    viewAllText: {
      color: '#007AFF',
      fontSize: 16,
      fontWeight: '500',
      marginRight: 4,
    },
   
    // Modal Styles
    modalHeaderOverride: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomColor: '#eee',
      borderBottomWidth: 1,
      paddingVertical: 15,
    },
   
    // Form Styles
    formContainer: {
      padding: 20,
    },
    formGroup: {
      marginBottom: 20,
    },
    formLabel: {
      fontSize: 18,
      fontWeight: '600',
      color: '#333',
      marginBottom: 12,
    },
    formInput: {
      fontSize: 16,
    },
   
    // Type Grid Styles
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
      marginHorizontal: -4,
    },
    typeGridItem: {
      width: '33.33%',
      padding: 4,
    },
    typeButtonGrid: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#E0E0E0',
      backgroundColor: '#F5F5F5',
      height: 60,
      minWidth: '100%',
    },
    typeButtonSelected: {
      borderColor: '#007AFF',
      backgroundColor: '#E3F2FD',
    },
    typeButtonText: {
      fontSize: 10,
      color: '#333',
      fontWeight: '500',
      flex: 1,
      
      lineHeight: 16,
    },
    typeButtonTextSelected: {
      color: '#007AFF',
    },
    typeButtonIcon: {
      marginLeft: 2,
    },
   
    // Photo Section Styles
    photoSection: {
      marginVertical: 20,
    },
    previewImage: {
      width: '100%',
      height: 200,
      borderRadius: 10,
      marginTop: 10,
    },
   
    // Button Container Styles
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 20,
      paddingBottom: 20,
    },
    buttonMargin: {
      marginRight: 10,
    },
   
    // Utility Styles
    loader: {
      marginVertical: 20,
    },
    emptyText: {
      textAlign: 'center',
      fontSize: 16,
      color: '#666',
      marginVertical: 20,
    },
   
    // Tab Bar Styles
    tabBarContainer: {
      paddingBottom: Platform.OS === 'ios' ? 20 : 0,
      borderTopWidth: 1,
      borderTopColor: '#E0E0E0',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: -2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 10,
    },
   });

export default ReportsScreen;