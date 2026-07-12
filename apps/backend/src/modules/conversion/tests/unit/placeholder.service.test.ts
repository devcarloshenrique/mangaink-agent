import { describe, it, expect } from 'vitest'
import { PlaceholderService } from '../../services/placeholder.service'

describe('PlaceholderService', () => {
  const service = new PlaceholderService()

  it('generate deve retornar Buffer não vazio', async () => {
    const buffer = await service.generate('KPW5', 'Cap. 1, Pág. 20')
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('buffer deve começar com magic bytes PNG', async () => {
    const buffer = await service.generate('KPW5', 'test')
    expect(buffer[0]).toBe(0x89)
    expect(buffer[1]).toBe(0x50)
    expect(buffer[2]).toBe(0x4e)
    expect(buffer[3]).toBe(0x47)
  })

  it('deviceId inválido usa resolução default (não lança erro)', async () => {
    const buffer = await service.generate('INVALID_DEVICE', 'test')
    expect(buffer[0]).toBe(0x89)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('dispositivo de alta resolução gera arquivo maior que baixa resolução', async () => {
    const bigBuffer = await service.generate('KPW5', 'test') // 1236x1648
    const smallBuffer = await service.generate('K34', 'test') // 600x800
    expect(smallBuffer.length).toBeLessThan(bigBuffer.length)
  })

  it('pageLabel diferente não quebra geração', async () => {
    const buffer = await service.generate('K11', 'Cap. 5, Pág. 12')
    expect(buffer.length).toBeGreaterThan(0)
  })
})
