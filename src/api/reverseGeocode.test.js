import { describe, expect, it } from 'vitest'
import { formatReverseGeocode, isCoordinatePair } from './reverseGeocode.js'

/**
 * These payloads are real BigDataCloud responses, captured so the label rules
 * stay pinned to observed data rather than to assumptions.
 */

const WESTLANDS = {
  city: 'Nairobi',
  locality: 'Nairobi',
  principalSubdivision: 'Nairobi City',
  countryName: 'Kenya',
  localityInfo: {
    administrative: [
      { adminLevel: 2, name: 'Kenya' },
      { adminLevel: 4, name: 'Nairobi City' },
      { adminLevel: 4, name: 'Nairobi' },
      { adminLevel: 6, name: 'Westlands' },
      { adminLevel: 7, name: 'Highridge division' },
      { adminLevel: 8, name: 'Karura ward' },
      { adminLevel: 10, name: 'Muthaiga sublocation' },
    ],
  },
}

const MANHATTAN = {
  city: 'New York City',
  locality: 'Manhattan',
  principalSubdivision: 'New York',
  countryName: 'United States of America',
  localityInfo: {
    administrative: [
      { adminLevel: 2, name: 'United States of America' },
      { adminLevel: 4, name: 'New York' },
      { adminLevel: 5, name: 'New York City' },
      { adminLevel: 7, name: 'Manhattan' },
      { adminLevel: 6, name: 'New York County' },
    ],
  },
}

const LONDON = {
  city: 'London',
  locality: 'City of Westminster',
  principalSubdivision: 'England',
  countryName: 'United Kingdom of Great Britain and Northern Ireland',
  localityInfo: { administrative: [{ adminLevel: 5, name: 'London' }] },
}

const MUMBAI = {
  city: 'Mumbai',
  locality: 'Mumbai',
  principalSubdivision: 'Maharashtra',
  countryName: 'India',
  localityInfo: {
    administrative: [
      { adminLevel: 4, name: 'Maharashtra' },
      { adminLevel: 7, name: 'Mumbai Metropolitan Region' },
      { adminLevel: 5, name: 'Mumbai' },
      { adminLevel: 5, name: 'Mumbai Suburban district' },
      { adminLevel: 10, name: 'L Ward' },
    ],
  },
}

const SYDNEY = {
  city: 'Sydney',
  locality: 'Sydney',
  principalSubdivision: 'New South Wales',
  countryName: 'Australia',
  localityInfo: {
    administrative: [
      { adminLevel: 4, name: 'New South Wales' },
      { adminLevel: 6, name: 'Sydney' },
      { adminLevel: 9, name: 'Sydney' },
    ],
  },
}

/** Out at sea: every human-readable field is a descriptive phrase or empty. */
const OPEN_OCEAN = {
  city: '',
  locality: 'exclusive economic zone of the United States',
  principalSubdivision: '',
  countryName: '',
  countryCode: '',
  localityInfo: { administrative: [] },
}

describe('formatReverseGeocode', () => {
  it('prefers a sub-city area over the city name', () => {
    expect(formatReverseGeocode(WESTLANDS).label).toBe('Westlands, Nairobi, Kenya')
  })

  it('uses the locality field when it adds information', () => {
    expect(formatReverseGeocode(MANHATTAN).label).toBe('Manhattan, New York City, United States')
  })

  it('shortens long legal country names', () => {
    expect(formatReverseGeocode(LONDON).label).toBe('City of Westminster, London, England, United Kingdom')
  })

  it('skips administrative noise like wards and districts', () => {
    const { label } = formatReverseGeocode(MUMBAI)
    expect(label).toBe('Mumbai, Maharashtra, India')
    expect(label).not.toMatch(/Ward|district|Metropolitan/i)
  })

  it('does not repeat the city as its own region', () => {
    expect(formatReverseGeocode(SYDNEY).label).toBe('Sydney, New South Wales, Australia')
  })

  it('drops a region that merely restates the city', () => {
    // "Nairobi City" contains "Nairobi", so the region would be redundant.
    expect(formatReverseGeocode(WESTLANDS).region).toBeNull()
  })

  it('keeps a region that is genuinely distinct', () => {
    expect(formatReverseGeocode(MANHATTAN).region).toBeNull()
    expect(formatReverseGeocode(MUMBAI).region).toBe('Maharashtra')
  })

  it('returns an empty label for a point with no place name', () => {
    expect(formatReverseGeocode(OPEN_OCEAN).label).toBe('')
  })

  it('never emits a descriptive phrase as the label', () => {
    expect(formatReverseGeocode(OPEN_OCEAN).label).not.toMatch(/exclusive economic zone/i)
  })

  it('tolerates an empty or malformed payload', () => {
    expect(formatReverseGeocode({}).label).toBe('')
    expect(formatReverseGeocode(null).label).toBe('')
  })

  it('prefers the coarsest usable admin level when locality only repeats the city', () => {
    // Westlands (L6) is used, not the finer Highridge division (L7).
    expect(formatReverseGeocode(WESTLANDS).area).toBe('Westlands')
  })
})

describe('isCoordinatePair', () => {
  it('accepts decimal coordinate pairs', () => {
    expect(isCoordinatePair('-1.2516,36.8459')).toBe(true)
    expect(isCoordinatePair('38.9697,-77.385')).toBe(true)
  })

  it('tolerates surrounding whitespace', () => {
    expect(isCoordinatePair(' 51.5 , -0.12 ')).toBe(true)
  })

  it('rejects named locations', () => {
    expect(isCoordinatePair('Nairobi,KE')).toBe(false)
    expect(isCoordinatePair('London, UK')).toBe(false)
  })

  it('rejects malformed or incomplete input', () => {
    expect(isCoordinatePair('38.9697')).toBe(false)
    expect(isCoordinatePair('')).toBe(false)
    expect(isCoordinatePair(null)).toBe(false)
  })

  it('rejects out-of-range coordinates', () => {
    expect(isCoordinatePair('91,181')).toBe(false)
    expect(isCoordinatePair('-91.5,0')).toBe(false)
  })
})
