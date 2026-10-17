import { describe, expect, it } from 'vitest'

import { authorise, configuredKeys, keyId, presentedKey } from './auth'

const KEY = 'swift-live-8f2c1a'
const OTHER = 'swift-live-000000'

function request(headers: Record<string, string> = {}): Request {
  return new Request('https://example.test/api/v1/meta', { headers })
}

const env = (value?: string) => ({ CATALOGUE_API_KEYS: value })

describe('configuredKeys', () => {
  it('splits on commas, so a rotation can hold two keys at once', () => {
    expect(configuredKeys(env(`${KEY}, ${OTHER}`))).toEqual([KEY, OTHER])
  })

  it('drops blanks, so a trailing comma is not an outage', () => {
    expect(configuredKeys(env(`${KEY},,  ,`))).toEqual([KEY])
  })

  it('is empty when the variable is absent or blank', () => {
    expect(configuredKeys({})).toEqual([])
    expect(configuredKeys(env('   '))).toEqual([])
  })
})

describe('presentedKey', () => {
  it('reads a bearer token', () => {
    expect(presentedKey(request({ authorization: `Bearer ${KEY}` }))).toBe(KEY)
  })

  it('accepts a lower-case scheme', () => {
    expect(presentedKey(request({ authorization: `bearer ${KEY}` }))).toBe(KEY)
  })

  it('reads x-api-key, which is what an API dashboard prints', () => {
    expect(presentedKey(request({ 'x-api-key': KEY }))).toBe(KEY)
  })

  it('prefers Authorization when both are present', () => {
    expect(
      presentedKey(request({ authorization: `Bearer ${KEY}`, 'x-api-key': OTHER })),
    ).toBe(KEY)
  })

  it('is null when nothing usable is presented', () => {
    expect(presentedKey(request())).toBeNull()
    expect(presentedKey(request({ authorization: 'Basic abc' }))).toBeNull()
    expect(presentedKey(request({ authorization: 'Bearer' }))).toBeNull()
    expect(presentedKey(request({ 'x-api-key': '  ' }))).toBeNull()
  })
})

describe('authorise', () => {
  it('fails closed when no keyring is configured', () => {
    expect(authorise(request({ authorization: `Bearer ${KEY}` }), {})).toEqual({
      status: 'unconfigured',
    })
  })

  it('refuses a request presenting nothing', () => {
    expect(authorise(request(), env(KEY))).toEqual({ status: 'rejected' })
  })

  it('refuses a key that is not ours', () => {
    expect(authorise(request({ authorization: `Bearer ${OTHER}` }), env(KEY))).toEqual({
      status: 'rejected',
    })
  })

  // The one that matters: a prefix of a real key must not pass, which is what
  // `timingSafeEqual` alone would have thrown on rather than rejected.
  it('refuses a prefix of a real key', () => {
    expect(authorise(request({ authorization: `Bearer ${KEY.slice(0, 8)}` }), env(KEY))).toEqual({
      status: 'rejected',
    })
  })

  it('accepts a key from either header', () => {
    const viaBearer = authorise(request({ authorization: `Bearer ${KEY}` }), env(KEY))
    const viaHeader = authorise(request({ 'x-api-key': KEY }), env(KEY))

    expect(viaBearer).toEqual({ status: 'ok', keyId: keyId(KEY) })
    expect(viaHeader).toEqual(viaBearer)
  })

  it('accepts the second key in a rotating keyring', () => {
    expect(authorise(request({ 'x-api-key': OTHER }), env(`${KEY},${OTHER}`))).toEqual({
      status: 'ok',
      keyId: keyId(OTHER),
    })
  })
})

describe('keyId', () => {
  it('is stable and does not contain the key', () => {
    expect(keyId(KEY)).toBe(keyId(KEY))
    expect(keyId(KEY)).not.toContain(KEY)
    expect(keyId(KEY)).toHaveLength(12)
  })

  it('differs between keys', () => {
    expect(keyId(KEY)).not.toBe(keyId(OTHER))
  })
})
