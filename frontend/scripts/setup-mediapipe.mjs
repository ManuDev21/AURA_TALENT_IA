// Prepara los recursos de MediaPipe en public/mediapipe (se ejecuta antes de dev y build).
// - Copia el runtime WASM desde node_modules (misma version que la dependencia instalada).
// - Descarga una sola vez los modelos oficiales de deteccion de rostro y de manos.
// Todo el procesamiento de camara ocurre en el navegador: ninguna imagen sale del equipo.
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'public', 'mediapipe')
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')

const MODELS = {
  'blaze_face_short_range.tflite':
    'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
  'hand_landmarker.task':
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
}

const exists = (p) => stat(p).then(() => true, () => false)

await mkdir(join(target, 'wasm'), { recursive: true })
await mkdir(join(target, 'models'), { recursive: true })

for (const file of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) {
  await copyFile(join(wasmSrc, file), join(target, 'wasm', file))
}

for (const [name, url] of Object.entries(MODELS)) {
  const dest = join(target, 'models', name)
  if (await exists(dest)) continue
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await writeFile(dest, Buffer.from(await res.arrayBuffer()))
    console.log(`[mediapipe] modelo descargado: ${name}`)
  } catch (err) {
    console.warn(`[mediapipe] no se pudo descargar ${name} (${err.message}). Vision y gestos quedaran desactivados.`)
  }
}
