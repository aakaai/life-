// Lecture des codes-barres : Safari sur iPhone n'a pas de lecteur intégré,
// on utilise donc ZXing compilé en WebAssembly (fichier servi par l'app elle-même).
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

prepareZXingModule({
  overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
  fireImmediately: false
})

const OPTIONS = { formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE'], tryHarder: true, maxNumberOfSymbols: 1 }

// input : ImageData (image de la caméra) ou Blob (photo)
export async function decodeBarcode(input) {
  const results = await readBarcodes(input, OPTIONS)
  const hit = results.find((r) => r.isValid && r.text)
  return hit ? hit.text : null
}
