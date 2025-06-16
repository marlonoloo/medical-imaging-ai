import { DicomState } from '../../../src/state/DicomState';

describe('DicomState', () => {
  beforeEach(() => {
    // Reset the state before each test
    // Since DicomState uses static properties, we need to reset it manually
    DicomState.setCurrentFile(null as any);
  });
  
  it('should store and retrieve the current file', () => {
    // Initially no file is set
    expect(DicomState.getCurrentFile()).toBeNull();
    
    // Create a test file
    const testFile = new File(['test content'], 'test.dcm');
    
    // Set the current file
    DicomState.setCurrentFile(testFile);
    
    // Check that the file is correctly stored
    const retrievedFile = DicomState.getCurrentFile();
    expect(retrievedFile).toBe(testFile);
    expect(retrievedFile?.name).toBe('test.dcm');
  });
  
  it('should overwrite previous file when setting a new one', () => {
    // Set an initial file
    const initialFile = new File(['initial content'], 'initial.dcm');
    DicomState.setCurrentFile(initialFile);
    expect(DicomState.getCurrentFile()).toBe(initialFile);
    
    // Set a new file
    const newFile = new File(['new content'], 'new.dcm');
    DicomState.setCurrentFile(newFile);
    
    // Check that the new file replaced the initial one
    const retrievedFile = DicomState.getCurrentFile();
    expect(retrievedFile).toBe(newFile);
    expect(retrievedFile).not.toBe(initialFile);
    expect(retrievedFile?.name).toBe('new.dcm');
  });
});