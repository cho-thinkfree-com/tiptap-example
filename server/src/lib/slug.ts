import { randomBytes } from 'node:crypto'

export const slugify = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-')
  return slug || randomSuffix()
}

export const ensureUniqueSlug = async (
  base: string,
  exists: (candidate: string) => Promise<boolean>,
  maxAttempts = 5,
): Promise<string> => {
  let candidate = slugify(base)
  if (!(await exists(candidate))) {
    return candidate
  }
  for (let i = 0; i < maxAttempts; i++) {
    const slug = `${candidate}-${randomSuffix()}`
    if (!(await exists(slug))) {
      return slug
    }
  }
  return `${candidate}-${randomSuffix()}`
}

const randomSuffix = () => randomBytes(3).toString('hex')
