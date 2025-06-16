import { BackendService } from '../../../src/services/backendService';

describe('BackendService', () => {
  let service: BackendService;
  let originalFetch: any;
  
  beforeEach(() => {
    originalFetch = global.fetch;
    service = new BackendService('http://test.api');
  });
  
  afterEach(() => {
    global.fetch = originalFetch;
  });
  
  describe('processImage', () => {
    it('should process a DICOM file for pneumonia detection', async () => {
      // Mock the fetch implementation for this test
      global.fetch = jest.fn().mockImplementation(() => 
        Promise.resolve({
          ok: true,
          headers: {
            get: jest.fn().mockImplementation((header) => {
              if (header === 'X-Probability') return '0.75';
              return null;
            })
          },
          blob: jest.fn().mockResolvedValue(new Blob())
        })
      );
      
      // Mock URL.createObjectURL
      URL.createObjectURL = jest.fn().mockReturnValue('blob:test-url');
      
      const file = new File([], 'test.dcm');
      const result = await service.processImage(file);
      
      // Check that fetch was called with the right parameters
      expect(fetch).toHaveBeenCalledWith('http://test.api/predict_cam/pneumonia', {
        method: 'POST',
        body: expect.any(FormData)
      });
      
      // Check that the result has the expected structure
      expect(result).toHaveProperty('imageUrl');
      expect(result).toHaveProperty('probability');
      expect(result.imageUrl).toBe('web:blob:test-url');
      expect(result.probability).toBe(0.75);
    });
    
    it('should throw an error when the API response is not ok', async () => {
      // Mock the fetch implementation to return a failed response
      global.fetch = jest.fn().mockImplementation(() => 
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })
      );
      
      const file = new File([], 'test.dcm');
      
      // Expect the processImage call to throw an error
      await expect(service.processImage(file)).rejects.toThrow('Failed to process image');
    });
  });
  
  describe('processCardiacImage', () => {
    it('should process a DICOM file for cardiac detection', async () => {
      // Mock the fetch implementation for this test
      global.fetch = jest.fn().mockImplementation(() => 
        Promise.resolve({
          ok: true,
          blob: jest.fn().mockResolvedValue(new Blob())
        })
      );
      
      // Mock URL.createObjectURL
      URL.createObjectURL = jest.fn().mockReturnValue('blob:test-url');
      
      const file = new File([], 'test.dcm');
      const result = await service.processCardiacImage(file);
      
      // Check that fetch was called with the right parameters
      expect(fetch).toHaveBeenCalledWith('http://test.api/predict_cardiac/cardiac', {
        method: 'POST',
        body: expect.any(FormData)
      });
      
      // Check the result
      expect(result).toBe('web:blob:test-url');
    });
    
    it('should throw an error when the API response is not ok', async () => {
      // Mock the fetch implementation to return a failed response
      global.fetch = jest.fn().mockImplementation(() => 
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })
      );
      
      const file = new File([], 'test.dcm');
      
      // Expect the processCardiacImage call to throw an error
      await expect(service.processCardiacImage(file)).rejects.toThrow('Failed to process cardiac image');
    });
  });
  
  describe('processSegmentation', () => {
    it('should process a NIfTI file for segmentation', async () => {
      // Mock the fetch implementation for this test
      global.fetch = jest.fn().mockImplementation(() => 
        Promise.resolve({
          ok: true,
          blob: jest.fn().mockResolvedValue(new Blob())
        })
      );
      
      // Mock URL.createObjectURL
      URL.createObjectURL = jest.fn().mockReturnValue('blob:test-url');
      
      const file = new File([], 'test.nii.gz');
      const result = await service.processSegmentation(file);
      
      // Check that fetch was called with the right parameters
      expect(fetch).toHaveBeenCalledWith('http://test.api/segment_atrium', {
        method: 'POST',
        body: expect.any(FormData)
      });
      
      // Check the result
      expect(result).toBe('web:blob:test-url');
    });
    
    it('should throw an error when the API response is not ok', async () => {
      // Mock the fetch implementation to return a failed response
      global.fetch = jest.fn().mockImplementation(() => 
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })
      );
      
      const file = new File([], 'test.nii.gz');
      
      // Expect the processSegmentation call to throw an error
      await expect(service.processSegmentation(file)).rejects.toThrow('Failed to process segmentation');
    });
  });
});