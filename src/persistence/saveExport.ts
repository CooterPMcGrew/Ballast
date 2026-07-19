// Native export delivery: the OS share sheet (built-in Share API — no new
// dependency). The user picks the destination: Drive, email, files app.

import { Share } from 'react-native';

export async function saveExportFile(json: string, fileName: string): Promise<void> {
  await Share.share({ title: fileName, message: json });
}
