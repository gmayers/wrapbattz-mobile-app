// utils/nfc.js
export const ndefToJson = (tag) => {
    try {
      if (tag.ndefMessage && tag.ndefMessage.length > 0) {
        const ndefRecord = tag.ndefMessage[0];
        const textDecoder = new TextDecoder();
        const payload = textDecoder.decode(ndefRecord.payload);
        const jsonString = payload.slice(3);
        return JSON.parse(jsonString);
      }
    } catch (error) {
      console.error('Error parsing NDEF:', error);
    }
    return null;
  };
  
  export const jsonToNdef = (jsonData) => {
    const payload = JSON.stringify(jsonData);
    return Ndef.encodeMessage([Ndef.textRecord(payload)]);
  };