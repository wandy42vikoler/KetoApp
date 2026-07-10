// Reads a File into { base64, mediaType } for sending to a vision Edge
// Function. No compression/resizing — fine for phone photos at this scale,
// revisit if Edge Function request-size limits become an issue.
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      const [header, base64] = dataUrl.split(',')
      const mediaType = header.match(/data:(.*);base64/)?.[1] ?? file.type
      resolve({ base64, mediaType })
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
