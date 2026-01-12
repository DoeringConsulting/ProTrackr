// File System Access API Helper for local file storage
/// <reference types="@types/wicg-file-system-access" />

let rootDirectoryHandle: FileSystemDirectoryHandle | null = null;

/**
 * Request user to select root directory for file storage
 */
export async function selectRootDirectory(): Promise<FileSystemDirectoryHandle> {
  try {
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    });
    
    rootDirectoryHandle = handle;
    localStorage.setItem('hasSelectedDirectory', 'true');
    
    return handle;
  } catch (error) {
    console.error('Failed to select directory:', error);
    throw error;
  }
}

/**
 * Get or request root directory handle
 */
export async function getRootDirectory(): Promise<FileSystemDirectoryHandle> {
  if (rootDirectoryHandle) {
    return rootDirectoryHandle;
  }
  
  return await selectRootDirectory();
}

/**
 * Create directory structure: Year/Month/Category
 */
export async function ensureDirectoryStructure(
  year: number,
  month: number,
  category: 'Rechnungen' | 'Berichte' | 'Reisekosten' | 'Belege' | 'Backups'
): Promise<FileSystemDirectoryHandle> {
  const root = await getRootDirectory();
  
  // Create DoringConsulting root folder
  const appRoot = await root.getDirectoryHandle('DoringConsulting', { create: true });
  
  // Create year folder
  const yearFolder = await appRoot.getDirectoryHandle(year.toString(), { create: true });
  
  // Create month folder (01-Januar, 02-Februar, etc.)
  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  const monthStr = `${month.toString().padStart(2, '0')}-${monthNames[month - 1]}`;
  const monthFolder = await yearFolder.getDirectoryHandle(monthStr, { create: true });
  
  // Create category folder
  const categoryFolder = await monthFolder.getDirectoryHandle(category, { create: true });
  
  return categoryFolder;
}

/**
 * Save file to local file system
 */
export async function saveFileToLocal(
  filename: string,
  content: Blob | string,
  year: number,
  month: number,
  category: 'Rechnungen' | 'Berichte' | 'Reisekosten' | 'Belege' | 'Backups'
): Promise<string> {
  try {
    const categoryFolder = await ensureDirectoryStructure(year, month, category);
    
    // Create file
    const fileHandle = await categoryFolder.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    
    if (typeof content === 'string') {
      await writable.write(content);
    } else {
      await writable.write(content);
    }
    
    await writable.close();
    
    // Return relative path
    const monthNames = [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];
    const monthStr = `${month.toString().padStart(2, '0')}-${monthNames[month - 1]}`;
    return `DoringConsulting/${year}/${monthStr}/${category}/${filename}`;
  } catch (error) {
    console.error('Failed to save file:', error);
    throw error;
  }
}

/**
 * Read file from local file system
 */
export async function readFileFromLocal(
  filename: string,
  year: number,
  month: number,
  category: 'Rechnungen' | 'Berichte' | 'Reisekosten' | 'Belege' | 'Backups'
): Promise<File> {
  try {
    const categoryFolder = await ensureDirectoryStructure(year, month, category);
    const fileHandle = await categoryFolder.getFileHandle(filename);
    return await fileHandle.getFile();
  } catch (error) {
    console.error('Failed to read file:', error);
    throw error;
  }
}

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window;
}

/**
 * Check if user has already selected a directory
 */
export function hasSelectedDirectory(): boolean {
  return localStorage.getItem('hasSelectedDirectory') === 'true';
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
    'Backups'
  );
}
