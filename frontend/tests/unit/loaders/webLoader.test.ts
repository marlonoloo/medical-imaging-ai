import { loadAndViewWebImage } from '../../../src/loaders/webLoader';
import { Types } from '@cornerstonejs/core';

describe('webLoader', () => {
  test('loadAndViewWebImage should set the stack and render the viewport', async () => {
    // Create a mock viewport
    const mockViewport = {
      setStack: jest.fn().mockResolvedValue(undefined),
      render: jest.fn()
    } as unknown as Types.IStackViewport;
    
    // Call the function
    await loadAndViewWebImage('web:test-image.png', mockViewport);
    
    // Verify the viewport methods were called with the correct parameters
    expect(mockViewport.setStack).toHaveBeenCalledWith(['web:test-image.png']);
    expect(mockViewport.render).toHaveBeenCalled();
  });
});