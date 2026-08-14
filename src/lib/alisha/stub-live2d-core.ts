// Stub for `live2dcubismcore` — the real runtime is loaded from
// /live2d/live2dcubismcore.min.js via a <script> tag at runtime,
// which sets window.Live2DCubismCore. This stub just lets the
// bundler resolve the import without errors.
export {};
declare global {
  interface Window {
    Live2DCubismCore?: any;
  }
}
