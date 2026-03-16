// components/home/components/NfcManager/styles.js
import { StyleSheet,Platform } from 'react-native';

export const getStyles = (colors) => StyleSheet.create({
  // Tab Content Styles
  nfcTabContent: {
    padding: 16,
    flex: 1,
  },
  nfcTabTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    color: colors.textPrimary,
  },
  nfcTabSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
  },

  // NFC Reading Status Styles
  readingStatusContainer: {
    marginTop: 20,
    marginBottom: 20,
    padding: 16,
    backgroundColor: colors.infoBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  readingStatusText: {
    textAlign: 'center',
    color: colors.infoText,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },

  // Result Display Styles
  resultContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 1,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: colors.textPrimary,
  },
  resultText: {
    color: colors.textTertiary,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
    lineHeight: 24,
  },
  emptyTagText: {
    color: colors.warning,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Helper Container Styles
  helperContainer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: colors.infoHighlightBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.infoHighlightBorder,
    alignItems: 'center',
  },
  helperTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.infoHighlightText,
    marginTop: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  helperText: {
    fontSize: 15,
    color: colors.infoHighlightText,
    lineHeight: 24,
    textAlign: 'left',
  },

  // Input Field Styles
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    backgroundColor: colors.card,
    fontSize: 16,
    color: colors.textPrimary,
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
    backgroundColor: colors.info,
    borderRadius: 8,
    height: 48,
  },
  writeButton: {
    backgroundColor: colors.success,
    marginTop: 12,
  },
  lockButton: {
    backgroundColor: colors.error,
    marginTop: 12,
  },
  unlockButton: {
    backgroundColor: colors.warning,
    marginTop: 12,
  },
  loadButton: {
    backgroundColor: colors.accentPurple,
    marginTop: 12,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  addFieldButton: {
    padding: 12,
    backgroundColor: colors.success,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 16,
  },
  addFieldText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Modal Styles
  modalContainer: {
    backgroundColor: colors.card,
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
    borderBottomColor: colors.borderLight,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 8,
  },

  // Tab Bar Styles
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
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
    backgroundColor: colors.card,
    borderRadius: 6,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  tabText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.info,
    fontWeight: '600',
  },

  // Form Group Styles
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: colors.textPrimary,
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
    color: colors.textSecondary,
  },
  successDot: {
    backgroundColor: colors.success,
  },
  errorDot: {
    backgroundColor: colors.error,
  },
  pendingDot: {
    backgroundColor: colors.warning,
  },

  // Message Styles
  message: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  successMessage: {
    backgroundColor: colors.successBg,
    borderColor: colors.successBorder,
    borderWidth: 1,
  },
  errorMessage: {
    backgroundColor: colors.errorBg,
    borderColor: colors.errorBorder,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  successMessageText: {
    color: colors.successText,
  },
  errorMessageText: {
    color: colors.errorTextAlt,
  },

  buttonGroup: {
    marginVertical: 12,
  },
  cancelButton: {
    backgroundColor: colors.error,
    borderRadius: 8,
    height: 48,
  },
});

