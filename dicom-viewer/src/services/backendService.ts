export class BackendService {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://127.0.0.1:5000') {
    this.baseUrl = baseUrl;
  }

  async processImage(dicomFile: File): Promise<{ imageUrl: string; probability: number }> {
    const formData = new FormData();
    formData.append('dicom', dicomFile);

    const response = await fetch(`${this.baseUrl}/predict_cam/pneumonia`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to process image');
    }

    const probabilityHeader = response.headers.get('X-Probability');
    const probability = probabilityHeader !== null ? parseFloat(probabilityHeader) || 0 : 0;

    const blob = await response.blob();
    const imageUrl = 'web:' + URL.createObjectURL(blob);

    return { imageUrl, probability };
  }

  async processCardiacImage(dicomFile: File): Promise<string> {
    const formData = new FormData();
    formData.append('dicom', dicomFile);

    const response = await fetch(`${this.baseUrl}/predict_cardiac/cardiac`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to process cardiac image');
    }

    const blob = await response.blob();
    return 'web:' + URL.createObjectURL(blob);
  }

  async processSegmentation(niftiData: any): Promise<string> {
    // Convert the volume data to a format that can be sent to the server
    const formData = new FormData();
    
    // If we have raw data, we can convert it to a Blob
    if (niftiData.data) {
      const blob = new Blob([niftiData.data], { type: 'application/octet-stream' });
      formData.append('nifti', blob, 'volume.nii');
    } else if (niftiData instanceof File) {
      // If it's already a file, use it directly
      formData.append('nifti', niftiData);
    } else {
      throw new Error('Invalid NIFTI data format');
    }

    const response = await fetch(`${this.baseUrl}/segment/atrium`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to process segmentation');
    }

    const blob = await response.blob();
    return 'web:' + URL.createObjectURL(blob);
  }
}

export const backendService = new BackendService();
