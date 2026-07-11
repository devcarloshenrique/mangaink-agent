import { describe, it, expect } from 'vitest'
import { GetConversionOptionsUseCase } from '../../use-cases/get-conversion-options.use-case'

const useCase = new GetConversionOptionsUseCase()

describe('GetConversionOptionsUseCase', () => {
  it('deve retornar devices, formats, fields e presets', () => {
    const options = useCase.execute()
    expect(options.devices.length).toBeGreaterThan(0)
    expect(options.formats.length).toBeGreaterThan(0)
    expect(options.fields.length).toBeGreaterThan(0)
    expect(options.presets.length).toBeGreaterThan(0)
  })

  it('não deve expor batchSplit nos fields', () => {
    const options = useCase.execute()
    const ids = options.fields.map((f) => f.id)
    expect(ids).not.toContain('batchSplit')
    expect(ids).not.toContain('fileFusion')
  })

  it('não deve expor batchSplit nem fileFusion nos presets.values', () => {
    const options = useCase.execute()
    for (const preset of options.presets) {
      expect(Object.keys(preset.values)).not.toContain('batchSplit')
      expect(Object.keys(preset.values)).not.toContain('fileFusion')
    }
  })

  it('deve retornar format EPUB como default', () => {
    const options = useCase.execute()
    const epub = options.formats.find((f) => f.id === 'EPUB')
    expect(epub?.default).toBe(true)
  })

  it('deve retornar campos com description e help não vazios', () => {
    const options = useCase.execute()
    for (const field of options.fields) {
      expect(field.description.length).toBeGreaterThan(0)
      expect(field.help.length).toBeGreaterThan(0)
    }
  })

  it('campos enum devem ter options com pelo menos 2 itens', () => {
    const options = useCase.execute()
    for (const field of options.fields.filter((f) => f.type === 'enum')) {
      expect(field.options).toBeDefined()
      expect(field.options!.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('campos numéricos devem ter min, max e step', () => {
    const options = useCase.execute()
    for (const field of options.fields.filter((f) => f.type === 'number')) {
      expect(field.min).toBeDefined()
      expect(field.max).toBeDefined()
      expect(field.step).toBeDefined()
    }
  })
})
