// Download-based file storage for iframe compatibility
// Files are automatically downloaded with structured filenames

/**
 * Generate structured filename with Polish folder structure
 */
function generateStructuredFilename(
  filename: string,
  year: number,
  month: number,
  category: 'Faktury' | 'Raporty' | 'Koszty_podrozy' | 'Dokumenty' | 'Kopie_zapasowe'
): string {
  const monthNames = [
    'Styczen', 'Luty', 'Marzec', 'Kwiecien', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpien', 'Wrzesien', 'Pazdziernik', 'Listopad', 'Grudzien'
  ];
  const monthStr = `${month.toString().padStart(2, '0')}-${monthNames[month - 1]}`;
  
  // Structure: DoringConsulting_YYYY_MM-Month_Category_filename
  return `DoringConsulting_${year}_${monthStr}_${category}_${filename}`;
}

/**
 * Download file with structured filename
 */
function downloadFile(filename: string, content: Blob | string) {
  const blob = typeof content === 'string' 
    ? new Blob([content], { type: 'text/plain' })
    : content;
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Save file to local storage (via download)
 */
export async function saveFileToLocal(
  filename: string,
  content: Blob | string,
  year: number,
  month: number,
  category: 'Faktury' | 'Raporty' | 'Koszty_podrozy' | 'Dokumenty' | 'Kopie_zapasowe'
): Promise<string> {
  try {
    const structuredFilename = generateStructuredFilename(filename, year, month, category);
    downloadFile(structuredFilename, content);
    
    // Return structured path for display
    const monthNames = [
      'Styczen', 'Luty', 'Marzec', 'Kwiecien', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpien', 'Wrzesien', 'Pazdziernik', 'Listopad', 'Grudzien'
    ];
    const monthStr = `${month.toString().padStart(2, '0')}-${monthNames[month - 1]}`;
    return `DoringConsulting/${year}/${monthStr}/${category}/${filename}`;
  } catch (error) {
    console.error('Failed to save file:', error);
    throw error;
  }
}

/**
 * Save backup to Backups folder
 */
export async function saveBackup(filename: string, content: string): Promise<string> {
  const now = new Date();
  return await saveFileToLocal(
    filename,
    content,
    now.getFullYear(),
    now.getMonth() + 1,
    'Kopie_zapasowe'
  );
}

/**
 * Check if File System Access API is supported (always false for iframe compatibility)
 */
export function isFileSystemAccessSupported(): boolean {
  return false; // Always use download-based approach for iframe compatibility
}

/**
 * Check if user has already selected a directory (not needed for download approach)
 */
export function hasSelectedDirectory(): boolean {
  return true; // Always return true to skip directory selection
}

/**
 * Dummy function for compatibility (not needed for download approach)
 */
export async function selectRootDirectory(): Promise<void> {
  // No-op for download-based approach
}

/**
 * Dummy function for compatibility (not needed for download approach)
 */
export async function getRootDirectory(): Promise<void> {
  // No-op for download-based approach
}

/**
 * Dummy function for compatibility (not needed for download approach)
 */
export async function ensureDirectoryStructure(
  year: number,
  month: number,
  category: 'Faktury' | 'Raporty' | 'Koszty_podrozy' | 'Dokumenty' | 'Kopie_zapasowe'
): Promise<void> {
  // No-op for download-based approach
}

/**
 * Read file from local file system (not supported in download approach)
 */
export async function readFileFromLocal(
  filename: string,
  year: number,
  month: number,
  category: 'Faktury' | 'Raporty' | 'Koszty_podrozy' | 'Dokumenty' | 'Kopie_zapasowe'
): Promise<File> {
  throw new Error('Reading files is not supported in download-based approach. Files are downloaded to your browser\'s download folder.');
}
