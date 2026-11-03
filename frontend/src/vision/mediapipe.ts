import type { FaceDetector, HandLandmarker } from '@mediapipe/tasks-vision'

/** Carga diferida de MediaPipe (WASM y modelos servidos localmente desde /mediapipe). */
const WASM = '/mediapipe/wasm'

let fileset: Promise<unknown> | null = null
let face: Promise<FaceDetector> | null = null
let hands: Promise<HandLandmarker> | null = null

async function vision() {
  const mod = await import('@mediapipe/tasks-vision')
  fileset ??= mod.FilesetResolver.forVisionTasks(WASM)
  return { mod, files: (await fileset) as Awaited<ReturnType<typeof mod.FilesetResolver.forVisionTasks>> }
}

export function loadFaceDetector(): Promise<FaceDetector> {
  face ??= vision().then(({ mod, files }) =>
    mod.FaceDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: '/mediapipe/models/blaze_face_short_range.tflite', delegate: 'GPU' },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.6,
    }),
  )
  face.catch(() => (face = null))
  return face
}

export function loadHandLandmarker(): Promise<HandLandmarker> {
  hands ??= vision().then(({ mod, files }) =>
    mod.HandLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: '/mediapipe/models/hand_landmarker.task', delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
    }),
  )
  hands.catch(() => (hands = null))
  return hands
}
