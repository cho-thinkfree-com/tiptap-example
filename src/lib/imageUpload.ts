import type { ImageNodeAttributes } from 'mui-tiptap'
import { getAssetUploadUrl, uploadAssetToS3, resolveAssetUrls } from './api'

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

// Helper to get image dimensions from file
const getImageDimensions = (file: File): Promise<{ width: number; height: number }> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve({ width: 0, height: 0 })
      URL.revokeObjectURL(url)
    }
    img.src = url
  })

export const filesToImageAttributes = async (
  files: File[],
  context?: { workspaceId: string; documentId: string }
): Promise<ImageNodeAttributes[]> => {
  const imageFiles = files.filter((file) => file.type.startsWith('image/'))

  if (!context) {
    // Fallback to Data URL if no context (e.g. not in a workspace document)
    const results = await Promise.all(
      imageFiles.map(async (file) => {
        const [src, dimensions] = await Promise.all([
          readFileAsDataUrl(file),
          getImageDimensions(file),
        ])
        return {
          src,
          alt: file.name ?? 'Embedded image',
          title: file.name,
          naturalWidth: dimensions.width || undefined,
          naturalHeight: dimensions.height || undefined,
        }
      })
    )
    return results.filter((image) => Boolean(image.src))
  }

  // Upload to S3
  return Promise.all(
    imageFiles.map(async (file) => {
      try {
        // Get image dimensions first
        const dimensions = await getImageDimensions(file)

        // 1. Get Presigned URL
        const { uploadUrl, odocsUrl } = await getAssetUploadUrl(context.workspaceId, context.documentId, file.type)

        // 2. Upload
        await uploadAssetToS3(uploadUrl, file)

        // 3. Resolve to Presigned URL for display
        // Use the remote URL immediately so it works for collaborators too
        let src = URL.createObjectURL(file) // Fallback
        try {
          const resolvedMap = await resolveAssetUrls(context.workspaceId, context.documentId, [odocsUrl])
          if (resolvedMap[odocsUrl]) {
            src = resolvedMap[odocsUrl]
          }
        } catch (e) {
          console.warn('Failed to resolve uploaded asset URL immediately', e)
        }

        return {
          src,
          alt: file.name,
          title: file.name,
          'data-odocs-url': odocsUrl, // Custom attribute to store the permanent URL
          naturalWidth: dimensions.width || undefined,
          naturalHeight: dimensions.height || undefined,
        }
      } catch (error) {
        console.error(`Failed to upload image ${file.name}:`, error)
        return null
      }
    })
  ).then((results) => results.filter((result): result is any => result !== null))
}

