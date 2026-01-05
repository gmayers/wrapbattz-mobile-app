// components/home/components/NfcManager/styles.js
import { StyleSheet,Platform } from 'react-native';

export const styles = StyleSheet.create({
  // Tab Content Styles
  nfcTabContent: {
    padding: 16,
    flex: 1,
  },
  nfcTabTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  nfcTabSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },

  // NFC Reading Status Styles
  readingStatusContainer: {
    marginTop: 20,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#90caf9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  readingStatusText: {
    textAlign: 'center',
    color: '#1976d2',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },

  // Result Display Styles
  resultContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  resultText: {
    color: '#444',
    fontSize: 16,
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 16,
    lineHeight: 24,
  },
  emptyTagText: {
    color: '#ff9800',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Helper Container Styles
  helperContainer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c9e0ff',
    alignItems: 'center',
  },
  helperTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0056b3',
    marginTop: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  helperText: {
    fontSize: 15,
    color: '#004085',
    lineHeight: 24,
    textAlign: 'left',
  },

  // Input Field Styles
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  writeFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },

  // Button Styles
  nfcButton: {
    marginVertical: 12,
    backgroundColor: '#2196f3',
    borderRadius: 8,
    height: 48,
  },
  writeButton: {
    backgroundColor: '#4caf50',
    marginTop: 12,
  },
  lockButton: {
    backgroundColor: '#f44336',
    marginTop: 12,
  },
  unlockButton: {
    backgroundColor: '#ff9800',
    marginTop: 12,
  },
  loadButton: {
    backgroundColor: '#9c27b0',
    marginTop: 12,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  addFieldButton: {
    padding: 12,
    backgroundColor: '#4caf50',
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 16,
  },
  addFieldText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Modal Styles
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },

  // Tab Bar Styles
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#fff',
    borderRadius: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#2196f3',
    fontWeight: '600',
  },

  // Form Group Styles
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  
  // Status Indicator Styles
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
  },
  successDot: {
    backgroundColor: '#4caf50',
  },
  errorDot: {
    backgroundColor: '#f44336',
  },
  pendingDot: {
    backgroundColor: '#ff9800',
  },

  // Message Styles
  message: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  successMessage: {
    backgroundColor: '#e8f5e9',
    borderColor: '#a5d6a7',
    borderWidth: 1,
  },
  errorMessage: {
    backgroundColor: '#ffebee',
    borderColor: '#ef9a9a',
    borderWidth: 1,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  successMessageText: {
    color: '#2e7d32',
  },
  errorMessageText: {
    color: '#c62828',
  },

  buttonGroup: {
    marginVertical: 12,
  },
  cancelButton: {
    backgroundColor: '#dc3545',
    borderRadius: 8,
    height: 48,
  },
});

