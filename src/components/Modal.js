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
  // Dynamic positioning styles
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
    {
      borderBottomWidth: showHeader ? 1 : 0,
    },
    headerStyle,
  ];

  return (
    <Modal
      animationType={animation}
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: overlayColor }, getPositionStyle()]}>
        <View style={modalContentStyle}>
          {showHeader && (
            <View style={headerStyleCombined}>
              <Text style={[styles.modalTitle, { color: titleColor, fontSize: titleSize }]}>
                {title}
              </Text>
              {customCloseButton || (
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={[styles.closeButtonText, { color: closeButtonColor, fontSize: closeButtonSize }]}>
                    ✕
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <View style={styles.modalBody}>
            {children}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Styles included in the same file
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
  },
  modalContent: {
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
    paddingBottom: 15,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontWeight: '500',
  },
  modalBody: {
    marginTop: 15,
  },
});

// Usage Example
const ExampleUsage = () => {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      {/* Basic Usage */}
      <CustomModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Basic Modal"
      >
        <Text>Basic modal content</Text>
      </CustomModal>

      {/* Customized Modal */}
      <CustomModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Custom Modal"
        backgroundColor="#f5f5f5"
        overlayColor="rgba(0, 0, 0, 0.7)"
        borderRadius={10}
        titleColor="#007AFF"
        titleSize={20}
        closeButtonColor="#007AFF"
        animation="fade"
        position="bottom"
        modalWidth={width * 0.9}
        headerStyle={{
          backgroundColor: '#fff',
          borderBottomColor: '#007AFF',
          borderBottomWidth: 2,
        }}
        contentStyle={{
          paddingHorizontal: 20,
        }}
        customCloseButton={
          <TouchableOpacity onPress={() => setModalVisible(false)}>
            <Text style={{color: '#007AFF'}}>Done</Text>
          </TouchableOpacity>
        }
      >
        <Text>Customized modal content</Text>
      </CustomModal>
    </>
  );
};

export default CustomModal;