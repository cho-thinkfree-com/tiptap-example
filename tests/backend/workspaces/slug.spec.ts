import { describe, it, expect } from 'vitest'
import { slugify } from '../../../server/src/lib/slug'

describe('slug helpers', () => {
  it('normalizes casing and special characters', () => {
    expect(slugify('My Workspace!')).toBe('my-workspace')
    expect(slugify('  Multiple   Spaces  ')).toBe('multiple-spaces')
    expect(slugify('____Leading%%Trailing***')).toBe('leading-trailing')
  })

  it('falls back to random suffix when name becomes empty', () => {
    const result = slugify('!!!')
    expect(result).toMatch(/^[a-f0-9]{6}$/)
  })
})
