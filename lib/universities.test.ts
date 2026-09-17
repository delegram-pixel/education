import { describe, expect, it } from 'vitest'

import { filterUniversities, getUniversityById, NIGERIAN_UNIVERSITIES } from './universities'

describe('university helpers', () => {
  it('includes a robust Nigerian university list', () => {
    expect(NIGERIAN_UNIVERSITIES.length).toBeGreaterThanOrEqual(20)
    expect(NIGERIAN_UNIVERSITIES.some((u) => u.name === 'University of Lagos')).toBe(true)
  })

  it('can find a university by id and search by name code', () => {
    expect(getUniversityById('unilag')?.code).toBe('UNILAG')
    expect(filterUniversities('ibadan').map((u) => u.id)).toContain('ui')
    expect(filterUniversities('oau').map((u) => u.name)).toContain('Obafemi Awolowo University')
  })
})
