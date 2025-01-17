import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const CustomModal = ({
  visible,
  onClose,
  children,
  title,
  // Customization props
  modalWidth = width * 0.85,
  modalHeight = 'auto',
  backgroundColor = 'white',
  overlayColor = 'rgba(0, 0, 0, 0.5)',
  borderRadius = 20,
  titleColor = '#333',
  titleSize = 18,
  closeButtonColor = '#666',
  closeButtonSize = 22,
  animation = 'slide',
  headerStyle,
  contentStyle,
  customCloseButton,
  showHeader = true,
  padding = 15,
  position = 'center',
}) => {
  // Dynamic positioning
  const getPositionStyle = () => {
    switch (position) {
      case 'top':
        return { justifyContent: 'flex-start', paddingTop: 50 };
      case 'bottom':
        return { justifyContent: 'flex-end', paddingBottom: 50 };
      default:
        return { justifyContent: 'center' };
    }
  };

  // Combine default and custom styles
  const modalContentStyle = [
    styles.modalContent,
    {
      width: modalWidth,
      height: modalHeight,
      backgroundColor,
      borderRadius,
      padding,
    },
    contentStyle,
  ];

  const headerStyleCombined = [
    styles.modalHeader,
    headerStyle, // let custom style override or add to defaults
  ];

  return (
    <Modal
      animationType={animation}
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.modalOverlay,
          { backgroundColor: overlayColor },
          getPositionStyle(),
        ]}
      >
        <View style={modalContentStyle}>
          {showHeader && (
            <View style={headerStyleCombined}>
              {/* Title on the far left */}
              <Text
                style={[
                  styles.modalTitle,
                  { color: titleColor, fontSize: titleSize },
                ]}
              >
                {title}
              </Text>

              {/* Close button on the far right */}
              {customCloseButton || (
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text
                    style={[
                      styles.closeButtonText,
                      { color: closeButtonColor, fontSize: closeButtonSize },
                    ]}
                  >
                    ✕
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <View style={styles.modalBody}>{children}</View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
  },
  modalContent: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    // Ensure we use the full width and keep items on one line
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'space-between',

    // Optional border under header
    borderBottomColor: '#eee',
    borderBottomWidth: 1,

    // Vertical spacing for the header
    paddingVertical: 15,
  },
  modalTitle: {
    fontWeight: 'bold',
    // left-aligned by default
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontWeight: '500',
  },
  modalBody: {
    marginTop: 10,
  },
});

export default CustomModal;
