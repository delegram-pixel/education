import { describe, expect, it } from 'vitest'

import { parseEnv } from '@/lib/env'

describe('parseEnv', () => {
  it('treats an empty environment as a valid, unconfigured one', () => {
    const env = parseEnv({})
    expect(env.DATABASE_URL).toBeUndefined()
    expect(env.GROQ_API_KEY).toBeUndefined()
    expect(env.GROQ_DAILY_CALL_LIMIT).toBe(200)
    expect(env.NODE_ENV).toBe('development')
  })

  it('treats blank values as unset rather than as empty secrets', () => {
    const env = parseEnv({ DATABASE_URL: '   ', GROQ_API_KEY: '' })
    expect(env.DATABASE_URL).toBeUndefined()
    expect(env.GROQ_API_KEY).toBeUndefined()
  })

  it('parses the daily budget from the environment', () => {
    expect(parseEnv({ GROQ_DAILY_CALL_LIMIT: '50' }).GROQ_DAILY_CALL_LIMIT).toBe(50)
    expect(parseEnv({ GROQ_DAILY_CALL_LIMIT: '0' }).GROQ_DAILY_CALL_LIMIT).toBe(0)
  })

  it('names the variable and the problem when a value is malformed', () => {
    expect(() => parseEnv({ APP_BASE_URL: 'not a url' })).toThrow(/APP_BASE_URL/)
    expect(() => parseEnv({ GROQ_DAILY_CALL_LIMIT: '-1' })).toThrow(/GROQ_DAILY_CALL_LIMIT/)
    expect(() => parseEnv({ GROQ_DAILY_CALL_LIMIT: 'many' })).toThrow(/GROQ_DAILY_CALL_LIMIT/)
  })

  it('keeps optional feature values when they are present', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgresql://user:pass@host/db',
      SWIFT_COMPANY_ID: 'company',
      SWIFT_API_KEY: 'key',
      CATALOGUE_API_KEYS: 'first,second',
      APP_BASE_URL: 'https://admissioncopilot.example',
    })

    expect(env.DATABASE_URL).toBe('postgresql://user:pass@host/db')
    expect(env.SWIFT_COMPANY_ID).toBe('company')
    expect(env.CATALOGUE_API_KEYS).toBe('first,second')
    expect(env.APP_BASE_URL).toBe('https://admissioncopilot.example')
  })
})
