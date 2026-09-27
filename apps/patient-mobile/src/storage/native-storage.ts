import * as SecureStore from 'expo-secure-store';
import { File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import type { PrivateStorage } from './session-store';

const key = 'hms.patient.native-session.v1';
const options: SecureStore.SecureStoreOptions = {
  keychainService: 'hms.patient.mobile', keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  requireAuthentication: false,
};
export function createNativeStorage(): PrivateStorage {
  const marker = new File(Paths.document, 'hms-installation.json');
  return {
    readSecret: () => SecureStore.getItemAsync(key, options),
    writeSecret: (value) => SecureStore.setItemAsync(key, value, options),
    deleteSecret: () => SecureStore.deleteItemAsync(key, options),
    readMarker: async () => marker.exists ? marker.text() : null,
    writeMarker: async (value) => { marker.write(value); },
    randomId: randomUUID,
  };
}
