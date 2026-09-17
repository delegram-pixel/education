export type University = {
  id: string
  name: string
  code: string
  state: string
  established: number
  website: string
}

export const UNIVERSITY_STORAGE_KEY = 'admission-copilot:selected-university'

export const DEFAULT_UNIVERSITY: University = {
  id: 'unilag',
  name: 'University of Lagos',
  code: 'UNILAG',
  state: 'Lagos',
  established: 1962,
  website: 'unilag.edu.ng',
}

export const NIGERIAN_UNIVERSITIES: University[] = [
  DEFAULT_UNIVERSITY,
  { id: 'ui', name: 'University of Ibadan', code: 'UI', state: 'Oyo', established: 1948, website: 'ui.edu.ng' },
  { id: 'oau', name: 'Obafemi Awolowo University', code: 'OAU', state: 'Osun', established: 1961, website: 'oauife.edu.ng' },
  { id: 'abu', name: 'Ahmadu Bello University', code: 'ABU', state: 'Kaduna', established: 1962, website: 'abu.edu.ng' },
  { id: 'unn', name: 'University of Nigeria, Nsukka', code: 'UNN', state: 'Enugu', established: 1960, website: 'unn.edu.ng' },
  { id: 'unilorin', name: 'University of Ilorin', code: 'UNILORIN', state: 'Kwara', established: 1975, website: 'unilorin.edu.ng' },
  { id: 'buk', name: 'Bayero University Kano', code: 'BUK', state: 'Kano', established: 1975, website: 'buk.edu.ng' },
  { id: 'futminna', name: 'Federal University of Technology, Minna', code: 'FUTMINNA', state: 'Niger', established: 1983, website: 'futminna.edu.ng' },
  { id: 'uniben', name: 'University of Benin', code: 'UNIBEN', state: 'Edo', established: 1970, website: 'uniben.edu' },
  { id: 'unizik', name: 'Nnamdi Azikiwe University', code: 'UNIZIK', state: 'Anambra', established: 1991, website: 'unizik.edu.ng' },
  { id: 'uniport', name: 'University of Port Harcourt', code: 'UNIPORT', state: 'Rivers', established: 1975, website: 'uniport.edu.ng' },
  { id: 'unijos', name: 'University of Jos', code: 'UNIJOS', state: 'Plateau', established: 1975, website: 'unijos.edu.ng' },
  { id: 'unimaid', name: 'University of Maiduguri', code: 'UNIMAID', state: 'Borno', established: 1975, website: 'unimaid.edu.ng' },
  { id: 'lautech', name: 'Ladoke Akintola University of Technology', code: 'LAUTECH', state: 'Oyo', established: 1990, website: 'lautech.edu.ng' },
  { id: 'rsu', name: 'Rivers State University', code: 'RSU', state: 'Rivers', established: 1980, website: 'rsu.edu.ng' },
  { id: 'fuoye', name: 'Federal University Oye-Ekiti', code: 'FUOYE', state: 'Ekiti', established: 2011, website: 'fuoye.edu.ng' },
  { id: 'aksu', name: 'Akwa Ibom State University', code: 'AKSU', state: 'Akwa Ibom', established: 2010, website: 'aksu.edu.ng' },
  { id: 'lasu', name: 'Lagos State University', code: 'LASU', state: 'Lagos', established: 1983, website: 'lasu.edu.ng' },
  { id: 'covenant', name: 'Covenant University', code: 'CU', state: 'Ogun', established: 2002, website: 'covenantuniversity.edu.ng' },
  { id: 'unical', name: 'University of Calabar', code: 'UNICAL', state: 'Cross River', established: 1975, website: 'unical.edu.ng' },
  { id: 'funab', name: 'Federal University of Agriculture, Abeokuta', code: 'FUNAB', state: 'Ogun', established: 1988, website: 'unaab.edu.ng' },
  { id: 'uniuyo', name: 'University of Uyo', code: 'UNIUYO', state: 'Akwa Ibom', established: 1991, website: 'uniuyo.edu.ng' },
  { id: 'abiastate', name: 'Abia State University', code: 'ABSU', state: 'Abia', established: 1981, website: 'abiastateuniversity.edu.ng' },
  { id: 'esut', name: 'Enugu State University of Science and Technology', code: 'ESUT', state: 'Enugu', established: 1980, website: 'esut.edu.ng' },
  { id: 'futao', name: 'Federal University of Technology, Akure', code: 'FUTA', state: 'Ondo', established: 1981, website: 'futa.edu.ng' },
]

export function getUniversityById(id: string | null | undefined): University | undefined {
  return NIGERIAN_UNIVERSITIES.find((university) => university.id === id)
}

export function filterUniversities(query: string): University[] {
  const term = query.trim().toLowerCase()
  if (!term) return NIGERIAN_UNIVERSITIES

  return NIGERIAN_UNIVERSITIES.filter((university) => {
    const haystack = `${university.name} ${university.code} ${university.state}`.toLowerCase()
    return haystack.includes(term)
  })
}

export function getStoredUniversityId(): string {
  if (typeof window === 'undefined') return DEFAULT_UNIVERSITY.id

  try {
    const raw = window.localStorage.getItem(UNIVERSITY_STORAGE_KEY)
    return raw && getUniversityById(raw) ? raw : DEFAULT_UNIVERSITY.id
  } catch {
    return DEFAULT_UNIVERSITY.id
  }
}

export function getStoredUniversity(): University {
  return getUniversityById(getStoredUniversityId()) ?? DEFAULT_UNIVERSITY
}
