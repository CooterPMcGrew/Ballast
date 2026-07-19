// Web export delivery: a plain browser download (dev preview + any future
// hosted web build). Same signature as the native share-sheet variant;
// Metro picks the platform file.

export async function saveExportFile(json: string, fileName: string): Promise<void> {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
