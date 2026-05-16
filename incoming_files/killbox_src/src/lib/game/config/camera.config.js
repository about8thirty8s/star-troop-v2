// LAST HUNT: KILLBOX - Camera Configuration
export const CAMERA_CONFIG = {
  // Zoom settings
  minZoom: 0.65,
  maxZoom: 2.5,
  defaultZoom: 1.0,
  zoomStep: 0.1,
  zoomSmoothness: 0.12,

  // Cinematic settings
  cinematicPanSpeed: 0.08,
  cinematicZoomSpeed: 0.1,
  insertionSequenceSteps: [
    { duration: 1.2, zoom: 0.75, action: 'heli_approach' },     // wide shot of heli coming in
    { duration: 0.8, zoom: 1.4, action: 'focus_ropes' },        // zoom on ropes dropping
    { duration: 3.0, zoom: 1.2, action: 'follow_descent' },     // follow squad descending
    { duration: 1.0, zoom: 0.9, action: 'heli_depart' },        // pull back as heli leaves
    { duration: 1.5, zoom: 1.0, action: 'return_to_player' },   // smooth return to player
  ],

  // Camera framing offsets
  cameraOffsetX: -390,
  cameraOffsetY: -320,
  cameraLerpX: 0.08,
  cameraLerpY: 0.08,
};