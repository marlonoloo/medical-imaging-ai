import type { Types } from '@cornerstonejs/core';

export async function loadAndViewWebImage(imageId: string, viewport: Types.IStackViewport) {
  await viewport.setStack([imageId]);
  viewport.render();
}
