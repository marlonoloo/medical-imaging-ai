const path = require('path');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '\\.(css|less)$': '<rootDir>/tests/mocks/styleMock.js',
    '@cornerstonejs/core': '<rootDir>/tests/mocks/cornerstoneMock.js',
    '@cornerstonejs/dicom-image-loader': '<rootDir>/tests/mocks/cornerstoneDicomImageLoaderMock.js',
    '@cornerstonejs/nifti-volume-loader': '<rootDir>/tests/mocks/cornerstoneNiftiLoaderMock.js',
    '@cornerstonejs/tools': '<rootDir>/tests/mocks/cornerstoneToolsMock.js'
  },
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts'
  ]
};