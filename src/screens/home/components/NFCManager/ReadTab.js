import React, { useState } from 'react';
import { View, Text, Alert, ScrollView } from 'react-native';
import Button from '../../../../components/Button';
import NfcManager, { Ndef } from 'react-native-nfc-manager';
import { styles } from './styles';

const normalizeJsonString = (jsonString) => {
  // Replace fancy quotes with standard quotes
  let normalized = jsonString
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')  // Replace various fancy double quotes
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'"); // Replace various fancy single quotes
  
  // Remove any control characters
  normalized = normalized.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  
  // Fix any malformed JSON that might have occurred from improper encoding
  // Common issues: unquoted property names, missing quotes around values
  try {
    // Test if it's valid after normalization
    JSON.parse(normalized);
    return normalized;
  } catch (e) {
    // Further repairs for common issues
    
    // Replace unquoted property names - find words followed by colon
    // but make sure we don't break existing quoted properties
    normalized = normalized.replace(/(\s*)(\w+)(\s*):(\s*)/g, (match, before, word, middle, after) => {
      // Don't replace if it's already part of a properly quoted structure
      if ((/"\w+"(\s*):/.test(match) || /'?\w+'?(\s*):/.test(match))) {
        return match;
      }
      return `${before}"${word}"${middle}:${after}`;
    });
    
    // Try to fix dangling quote issues by detecting unbalanced quotes
    let quoteCount = 0;
    for (let i = 0; i < normalized.length; i++) {
      if (normalized[i] === '"' && (i === 0 || normalized[i-1] !== '\\')) {
        quoteCount++;
      }
    }
    
    if (quoteCount % 2 !== 0) {
      // Unbalanced quotes - try to identify and fix the issue
      // This is a simplified approach - for complex fixes, you might need
      // a more sophisticated parser-based approach
      console.log("[ReadTab] Detected unbalanced quotes, attempting fix");
      
      // One simple fix is to add a closing quote before any commas or closing braces
      // that follow an unquoted string
      normalized = normalized.replace(/([^"\s,{}[\]]+)(\s*)(,|\}|\])/g, '$1"$2$3');
      
      // Also fix any values that should start with a quote but don't
      normalized = normalized.replace(/:(\s*)([^"\s,{}[\]][^,{}[\]]*)/g, ':$1"$2"');
    }
    
    return normalized;
  }
};

const ReadTab = ({ withNfcManager, onCancel }) => {
  const [isReading, setIsReading] = useState(false);
  const [readResult, setReadResult] = useState(null);

  // Create a debug logger to keep track of all steps
  const [debugLogs, setDebugLogs] = useState([]);
  
  const addDebugLog = (message) => {
    console.log(`[ReadTab] ${message}`);
    setDebugLogs(prevLogs => [...prevLogs, `[${new Date().toISOString()}] ${message}`]);
  };

  const cancelNfcRead = async () => {
    setIsReading(false);
    addDebugLog('Read operation cancelled by user');
    onCancel?.();
  };

  const handleReadNfc = async () => {
    try {
      setIsReading(true);
      setReadResult(null);
      setDebugLogs([]); // Clear previous logs
      
      addDebugLog('Starting NFC read operation');
      
      await withNfcManager(async () => {
        addDebugLog('NFC technology acquired');
        
        const tag = await NfcManager.getTag();
        addDebugLog(`Tag detected: ${tag ? 'Yes' : 'No'}`);
        
        if (!tag) {
          addDebugLog('Error: No tag detected');
          Alert.alert('Error', 'No NFC tag detected.');
          return;
        }
        
        addDebugLog(`Tag ID: ${tag.id || 'Unknown'}`);
        addDebugLog(`Tag tech types: ${JSON.stringify(tag.techTypes || [])}`);
        
        if (!tag.ndefMessage || !tag.ndefMessage.length) {
          addDebugLog('Error: No NDEF message found on tag');
          Alert.alert('Error', 'No NDEF message found on tag.');
          return;
        }
        
        addDebugLog(`NDEF message contains ${tag.ndefMessage.length} records`);
        
        // Process first NDEF record
        const record = tag.ndefMessage[0];
        
        addDebugLog(`Record TNF: ${record?.tnf}`);
        addDebugLog(`Record type: ${record?.type ? new TextDecoder().decode(record.type) : 'null'}`);
        
        if (record && record.payload && record.tnf === 1) {
          try {
            // For debugging
            const rawBuffer = new Uint8Array(record.payload);
            addDebugLog(`Raw payload (${rawBuffer.length} bytes): [${Array.from(rawBuffer).join(', ')}]`);
            addDebugLog(`Raw payload (hex): ${Array.from(rawBuffer).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
            
            // Analyze first few bytes for debugging
            if (rawBuffer.length > 0) {
              const statusByte = rawBuffer[0];
              const languageLength = statusByte & 0x3F;
              const isUTF16 = !(statusByte & 0x80);
              
              addDebugLog(`Status byte: ${statusByte} (${statusByte.toString(16)}h)`);
              addDebugLog(`Language code length: ${languageLength}`);
              addDebugLog(`Encoding: ${isUTF16 ? 'UTF-16' : 'UTF-8'}`);
              
              if (rawBuffer.length > 1 + languageLength) {
                const langCode = Array.from(rawBuffer.slice(1, 1 + languageLength))
                  .map(code => String.fromCharCode(code))
                  .join('');
                addDebugLog(`Language code: "${langCode}"`);
              }
            }
            
            // Properly decode the NDEF Text Record payload
            let textContent;
            try {
              textContent = Ndef.text.decodePayload(record.payload);
              addDebugLog(`Standard decoded text: "${textContent}"`);
            } catch (e) {
              addDebugLog(`Error during standard decoding: ${e.message}`);
              
              // Manual decoding fallback
              try {
                // Get a byte array from the payload
                const bytes = [...new Uint8Array(record.payload)];
                
                // First byte contains status and language length
                const statusByte = bytes[0];
                const languageLength = statusByte & 0x3F;
                const isUTF16 = !(statusByte & 0x80);
                
                addDebugLog(`Manual decode - Status byte: ${statusByte}, Language length: ${languageLength}, Encoding: ${isUTF16 ? 'UTF-16' : 'UTF-8'}`);
                
                // Skip language code and status byte
                const textBytes = bytes.slice(1 + languageLength);
                addDebugLog(`Text bytes length: ${textBytes.length}`);
                addDebugLog(`First few text bytes: [${textBytes.slice(0, Math.min(10, textBytes.length)).join(', ')}${textBytes.length > 10 ? '...' : ''}]`);
                
                // Convert to string based on encoding
                if (isUTF16) {
                  // UTF-16 encoding
                  addDebugLog('Attempting UTF-16 decoding');
                  const uint16Array = new Uint16Array(textBytes.length / 2);
                  for (let i = 0; i < textBytes.length; i += 2) {
                    uint16Array[i / 2] = (textBytes[i] << 8) | textBytes[i + 1];
                  }
                  textContent = String.fromCharCode.apply(null, uint16Array);
                } else {
                  // UTF-8 encoding
                  addDebugLog('Attempting UTF-8 decoding');
                  textContent = String.fromCharCode.apply(null, textBytes);
                }
                
                addDebugLog(`Manually decoded text: "${textContent}"`);
              } catch (manualError) {
                addDebugLog(`Manual decoding failed: ${manualError.message}`);
                throw e; // rethrow the original error
              }
            }
            
            // Check if it's valid JSON and process accordingly
            if (textContent && (textContent.startsWith('{') || textContent.startsWith('['))) {
              try {
                // Normalize and clean JSON string
                const cleanJson = normalizeJsonString(textContent.trim());
                addDebugLog(`Normalized JSON: ${cleanJson}`);
                
                // Log any potential problematic characters
                if (/[\u0000-\u001F\u007F-\u009F]/.test(cleanJson)) {
                  addDebugLog('WARNING: JSON contains control characters that may cause parsing issues');
                  
                  // Log each character for thorough debugging
                  addDebugLog('Character by character breakdown:');
                  for (let i = 0; i < cleanJson.length; i++) {
                    const char = cleanJson[i];
                    const code = cleanJson.charCodeAt(i);
                    addDebugLog(`Position ${i}: '${char}' (${code})`);
                    
                    // Pay special attention to characters around position where error might occur
                    if (i > 0 && (char === ']' || char === '}')) {
                      const prevChar = cleanJson[i-1];
                      addDebugLog(`POTENTIAL ISSUE: '${prevChar}' followed by '${char}' at position ${i}`);
                    }
                  }
                }
                
                // Standard JSON parsing
                const jsonData = JSON.parse(cleanJson);
                addDebugLog(`Parsed JSON data: ${JSON.stringify(jsonData)}`);
                
                // Format as key-value pairs
                const formattedData = {};
                if (Array.isArray(jsonData)) {
                  // Handle array data
                  addDebugLog('JSON is an array');
                  formattedData["Array Data"] = JSON.stringify(jsonData);
                } else {
                  // Handle object data
                  addDebugLog('JSON is an object');
                  Object.entries(jsonData).forEach(([key, value]) => {
                    addDebugLog(`Processing property "${key}" with value type: ${typeof value}`);
                    formattedData[key] = typeof value === 'object' ? JSON.stringify(value) : value;
                  });
                }
                
                addDebugLog('Setting formatted result data');
                setReadResult(formattedData);
                Alert.alert('Success', 'NFC tag read successfully!');
                return;
              } catch (jsonError) {
                addDebugLog(`JSON parse error: ${jsonError.message}`);
                addDebugLog(`Error occurred at position: ${jsonError.message.match(/position (\d+)/)?.[1] || 'unknown'}`);
                addDebugLog(`Content that caused error: "${textContent}"`);
                
                // If not valid JSON, use text directly
                setReadResult({ 
                  "Content": textContent,
                  "Parse Error": jsonError.message
                });
                Alert.alert('Partial Success', 'NFC tag read as text (invalid JSON format)');
                return;
              }
            } else if (textContent) {
              // Not JSON, use text directly
              addDebugLog(`Content is not JSON: "${textContent}"`);
              setReadResult({ "Content": textContent });
              Alert.alert('Success', 'NFC tag read successfully!');
              return;
            } else {
              addDebugLog('Error: Empty or invalid text content');
              throw new Error('Empty or invalid text content');
            }
          } catch (e) {
            addDebugLog(`Error decoding payload: ${e.message}`);
            
            // Last resort: try to use the raw payload as a buffer
            try {
              const rawBuffer = new Uint8Array(record.payload);
              const rawHex = Array.from(rawBuffer)
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ');
              
              addDebugLog(`Showing raw hex data: ${rawHex}`);
              
              setReadResult({ 
                "Raw Payload (Hex)": rawHex,
                "Record Type": record.type ? new TextDecoder().decode(record.type) : 'Unknown',
                "TNF": record.tnf,
                "Debug Logs": debugLogs.join('\n')
              });
              Alert.alert('Partial Success', 'Could not decode tag text. Showing raw data.');
              return;
            } catch (rawError) {
              addDebugLog(`Raw data extraction failed: ${rawError.message}`);
            }
          }
        } else {
          addDebugLog('Error: Invalid record format');
        }
        
        // If we reached here, we couldn't extract the data properly
        addDebugLog('Failed to extract data from tag');
        setReadResult({
          "Error": "Could not read data from tag",
          "Debug Logs": debugLogs.join('\n')
        });
        Alert.alert('Error', 'Could not read data from tag.');
      });
    } catch (error) {
      addDebugLog(`Error in read operation: ${error.message}`);
      addDebugLog(`Error stack: ${error.stack}`);
      
      // Include debug logs in the result for troubleshooting
      setReadResult({
        "Error": error.message,
        "Debug Logs": debugLogs.join('\n')
      });
      
      Alert.alert(
        'Error', 
        'Failed to read NFC tag. See debug information for details.'
      );
    } finally {
      setIsReading(false);
      addDebugLog('Read process completed');
    }
  };

  // Render the key-value pairs
  const renderKeyValuePairs = () => {
    if (!readResult) return null;
    
    return Object.entries(readResult).map(([key, value]) => (
      <Text key={key} style={styles.resultText}>
        <Text style={styles.resultKey}>{key}:</Text> {String(value)}
      </Text>
    ));
  };

  return (
    <View style={styles.nfcTabContent}>
      <Text style={styles.nfcTabTitle}>Read NFC Tag</Text>
      <Text style={styles.nfcTabSubtitle}>Place your device near an NFC tag to read data.</Text>
      
      {isReading ? (
        <View style={styles.buttonGroup}>
          <Button
            title="Cancel Read"
            onPress={cancelNfcRead}
            style={styles.cancelButton}
          />
        </View>
      ) : (
        <Button
          title="Read Tag"
          onPress={handleReadNfc}
          style={styles.nfcButton}
          disabled={isReading}
        />
      )}

      {isReading && (
        <View style={styles.readingStatusContainer}>
          <Text style={styles.readingStatusText}>
            Ready to read... Place NFC tag near device
          </Text>
        </View>
      )}

      {readResult && !isReading && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Data:</Text>
          {renderKeyValuePairs()}
        </View>
      )}

      {/* Debug Logs Section */}
      {debugLogs.length > 0 && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>Debug Logs:</Text>
          <ScrollView style={styles.debugLogsContainer}>
            {debugLogs.map((log, index) => (
              <Text key={index} style={styles.debugText}>{log}</Text>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

export default ReadTab;