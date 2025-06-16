import type { Types } from '@cornerstonejs/core';
import { loadAndViewImage } from '../dicomHelper';
import { loadAndViewWebImage } from '../loaders/webLoader';

export class ViewportService {
  static async loadDicomImage(imageId: string, viewport: Types.IStackViewport): Promise<void> {
    return loadAndViewImage(imageId, viewport);
  }

  static async loadWebImage(imageId: string, viewport: Types.IStackViewport): Promise<void> {
    return loadAndViewWebImage(imageId, viewport);
  }
}
