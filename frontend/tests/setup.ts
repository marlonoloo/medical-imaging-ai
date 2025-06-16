// tests/setup.ts
/// <reference types="jest" />
import '@testing-library/jest-dom';

// Mock for cornerstone objects and global APIs
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock the canvas and ImageBitmap with type assertions to satisfy TypeScript
global.HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  drawImage: jest.fn(),
  getImageData: jest.fn(() => ({
    data: new Uint8ClampedArray(100),
  })),
  // Add minimal properties to satisfy TypeScript type checking
  canvas: document.createElement('canvas'),
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  beginPath: jest.fn(),
  // Casting to any to avoid having to implement the entire interface
} as any));

global.ImageBitmap = jest.fn();
global.createImageBitmap = jest.fn(() => Promise.resolve({
  width: 100,
  height: 100,
  // Add the close method to satisfy the ImageBitmap interface
  close: jest.fn()
} as ImageBitmap));

// Mock fetch API
global.fetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    blob: () => Promise.resolve(new Blob()),
    headers: new Headers({ 'X-Probability': '0.75' }),
  })
);

// Silence console errors during tests
jest.spyOn(console, 'error').mockImplementation(() => {});