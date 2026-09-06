import { describe, it, expect } from 'vitest'
import { uploadCoverBodySchema, uploadedCoverParamsSchema, uploadCoverResponseSchema } from '../../dtos/upload-cover.dto'

describe('uploadCoverDto (Unit)', () => {
  describe('uploadCoverBodySchema', () => {
    it('valida payload correto com jpeg', () => {
      const result = uploadCoverBodySchema.safeParse({
        fileName: 'my_cover.jpg',
        contentType: 'image/jpeg',
        base64Data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
      })
      expect(result.success).toBe(true)
    })

    it('valida payload com sourceId e label opcionais', () => {
      const result = uploadCoverBodySchema.safeParse({
        fileName: 'my_cover.jpg',
        contentType: 'image/jpeg',
        base64Data: 'abc',
        sourceId: 'src-manga-123',
        label: 'Volume 1 Custom',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sourceId).toBe('src-manga-123')
        expect(result.data.label).toBe('Volume 1 Custom')
      }
    })

    it('rejeita sourceId vazio se fornecido', () => {
      const result = uploadCoverBodySchema.safeParse({
        fileName: 'my_cover.jpg',
        contentType: 'image/jpeg',
        base64Data: 'abc',
        sourceId: '   ',
      })
      expect(result.success).toBe(false)
    })

    it('rejeita label maior que 100 caracteres', () => {
      const result = uploadCoverBodySchema.safeParse({
        fileName: 'my_cover.jpg',
        contentType: 'image/jpeg',
        base64Data: 'abc',
        label: 'a'.repeat(101),
      })
      expect(result.success).toBe(false)
    })

    it('valida payload correto com png e webp', () => {
      expect(
        uploadCoverBodySchema.safeParse({
          fileName: 'my_cover.png',
          contentType: 'image/png',
          base64Data: 'abc',
        }).success,
      ).toBe(true)

      expect(
        uploadCoverBodySchema.safeParse({
          fileName: 'my_cover.webp',
          contentType: 'image/webp',
          base64Data: 'abc',
        }).success,
      ).toBe(true)
    })

    it('rejeita contentType não suportado', () => {
      const result = uploadCoverBodySchema.safeParse({
        fileName: 'bad.gif',
        contentType: 'image/gif',
        base64Data: 'abc',
      })
      expect(result.success).toBe(false)
    })

    it('rejeita fileName vazio', () => {
      const result = uploadCoverBodySchema.safeParse({
        fileName: '',
        contentType: 'image/jpeg',
        base64Data: 'abc',
      })
      expect(result.success).toBe(false)
    })

    it('rejeita base64Data vazio', () => {
      const result = uploadCoverBodySchema.safeParse({
        fileName: 'cover.jpg',
        contentType: 'image/jpeg',
        base64Data: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejeita base64Data acima do teto de 15 MiB', () => {
      const result = uploadCoverBodySchema.safeParse({
        fileName: 'cover.jpg',
        contentType: 'image/jpeg',
        base64Data: 'a'.repeat(20971585),
      })
      expect(result.success).toBe(false)
    })
  })

  describe('uploadedCoverParamsSchema', () => {
    it('valida uploadId válido', () => {
      const result = uploadedCoverParamsSchema.safeParse({
        uploadId: 'up_abc123',
      })
      expect(result.success).toBe(true)
    })

    it('rejeita uploadId vazio', () => {
      const result = uploadedCoverParamsSchema.safeParse({
        uploadId: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('uploadCoverResponseSchema', () => {
    it('valida resposta com coverId e sourceId opcionais', () => {
      const result = uploadCoverResponseSchema.safeParse({
        uploadId: 'up_123',
        name: 'cover.jpg',
        url: '/api/conversions/covers/uploaded/up_123',
        sourceId: 'src-123',
        coverId: 'up_123',
      })
      expect(result.success).toBe(true)
    })
  })
})
