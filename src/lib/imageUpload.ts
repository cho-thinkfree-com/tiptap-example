import type { ImageNodeAttributes } from 'mui-tiptap'

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read file'))
    }
    reader.readAsDataURL(file)
  })

export const filesToImageAttributes = async (files: File[]): Promise<ImageNodeAttributes[]> => {
  const imageFiles = files.filter((file) => file.type.startsWith('image/'))
  const sources = await Promise.all(imageFiles.map((file) => readFileAsDataUrl(file)))

  return sources
    .map((src, index) => ({
      src,
      alt: imageFiles[index]?.name ?? 'Embedded image',
      title: imageFiles[index]?.name,
    }))
    .filter((image) => Boolean(image.src))
}

