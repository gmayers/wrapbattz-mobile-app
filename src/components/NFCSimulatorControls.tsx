// src/components/NFCSimulatorControls.tsx - Dev-only UI for NFC Simulator control
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { nfcSimulator, SimulatedTag } from '../services/NFCSimulator';

interface NFCSimulatorControlsProps {
  visible?: boolean;
}

/**
 * Dev-only UI panel for controlling the NFC Simulator.
 * Only use this component in development builds.
 */
const NFCSimulatorControls: React.FC<NFCSimulatorControlsProps> = ({ visible = true }) => {
  const [isEnabled, setIsEnabled] = useState(nfcSimulator.isEnabled());
  const [selectedTagId, setSelectedTagId] = useState(nfcSimulator.getConfig().selectedTagId);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTagDetails, setSelectedTagDetails] = useState<SimulatedTag | undefined>();
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setAvailableTags(nfcSimulator.getAvailableTagIds());
    updateSelectedTagDetails();
  }, []);

  const updateSelectedTagDetails = () => {
    const tag = nfcSimulator.getSelectedTag();
    setSelectedTagDetails(tag);
  };

  const handleToggleSimulator = (value: boolean) => {
    nfcSimulator.setEnabled(value);
    setIsEnabled(value);
  };

  const handleSelectTag = (tagId: string) => {
    nfcSimulator.selectTag(tagId);
    setSelectedTagId(tagId);
    updateSelectedTagDetails();
  };

  const handleResetTags = () => {
    nfcSimulator.resetTags();
    setAvailableTags(nfcSimulator.getAvailableTagIds());
    setSelectedTagId(nfcSimulator.getConfig().selectedTagId);
    updateSelectedTagDetails();
  };

  if (!visible) return null;

  // Only show in dev mode
  if (__DEV__ === false) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <Text style={styles.headerText}>NFC Simulator</Text>
        <Text style={styles.headerIcon}>{isExpanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.content}>
          <View style={styles.row}>
            <Text style={styles.label}>Enable Simulator</Text>
            <Switch
              value={isEnabled}
              onValueChange={handleToggleSimulator}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={isEnabled ? '#007aff' : '#f4f3f4'}
            />
          </View>

          {isEnabled && (
            <>
              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>Select Tag:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tagList}
              >
                {availableTags.map((tagId) => (
                  <TouchableOpacity
                    key={tagId}
                    style={[
                      styles.tagButton,
                      selectedTagId === tagId && styles.tagButtonSelected,
                    ]}
                    onPress={() => handleSelectTag(tagId)}
                  >
                    <Text
                      style={[
                        styles.tagButtonText,
                        selectedTagId === tagId && styles.tagButtonTextSelected,
                      ]}
                    >
                      {tagId.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {selectedTagDetails && (
                <View style={styles.tagDetails}>
                  <Text style={styles.detailText}>
                    ID: {selectedTagDetails.id}
                  </Text>
                  <Text style={styles.detailText}>
                    Type: {selectedTagDetails.type}
                  </Text>
                  <Text style={styles.detailText}>
                    Capacity: {selectedTagDetails.maxSize} bytes
                  </Text>
                  <Text style={styles.detailText}>
                    Writable: {selectedTagDetails.isWritable ? 'Yes' : 'No'}
                  </Text>
                  <Text style={styles.detailText}>
                    Locked: {selectedTagDetails.isLocked ? 'Yes' : 'No'}
                  </Text>
                  <Text style={styles.detailText} numberOfLines={2}>
                    Content: {selectedTagDetails.content || '(empty)'}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleResetTags}
              >
                <Text style={styles.resetButtonText}>Reset All Tags</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffc107',
    borderRadius: 8,
    margin: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#ffc107',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
  },
  headerIcon: {
    fontSize: 12,
    color: '#856404',
  },
  content: {
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0c369',
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  tagList: {
    marginBottom: 12,
  },
  tagButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  tagButtonSelected: {
    backgroundColor: '#007aff',
    borderColor: '#007aff',
  },
  tagButtonText: {
    fontSize: 12,
    color: '#333',
  },
  tagButtonTextSelected: {
    color: '#fff',
  },
  tagDetails: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  detailText: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  resetButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default NFCSimulatorControls;
