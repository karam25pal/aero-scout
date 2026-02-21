

# Fix Flight Search: Switch from SerpApi to SkyScanner (RapidAPI)

## Problem
The current flight search is failing because the SerpApi key is invalid. Every search returns a 500 error with "Invalid API key."

## Solution
Switch the flight search backend to use the **SkyScanner API on RapidAPI**, which can use the `RAPIDAPI_KEY` you already have configured -- no new API key needed.

## What Changes

### 1. Rewrite `supabase/functions/search-flights/index.ts`
- Replace SerpApi calls with SkyScanner RapidAPI calls (`sky-scanner3.p.rapidapi.com`)
- Use the `RAPIDAPI_KEY` secret (already configured) instead of `SERPAPI_KEY`
- Use the `/flights/search-one-way` and `/flights/search-roundtrip` endpoints
- Transform SkyScanner's response format (itineraries with legs, carriers, pricing) into the existing frontend format
- Keep the same response shape so the frontend works without changes

### 2. No Frontend Changes Needed
The edge function will continue returning the same JSON structure (`success`, `data`, `meta`) with the same flight object shape (price, legs, carriers, stopCount, etc.).

## Technical Details

**API Call:**
```text
GET https://sky-scanner3.p.rapidapi.com/flights/search-one-way
  ?fromEntityId=LHR
  &toEntityId=DXB
  &departDate=2026-02-22
  &currency=GBP
  &adults=1
  &cabinClass=economy
Headers:
  x-rapidapi-host: sky-scanner3.p.rapidapi.com
  x-rapidapi-key: {RAPIDAPI_KEY}
```

**Response Mapping:**
| SkyScanner Field | Current App Field |
|---|---|
| `itinerary.price.raw` | `price.raw` |
| `itinerary.price.formatted` | `price.formatted` |
| `itinerary.legs[].origin` | `legs[].origin` |
| `itinerary.legs[].destination` | `legs[].destination` |
| `itinerary.legs[].departure` | `legs[].departure` |
| `itinerary.legs[].arrival` | `legs[].arrival` |
| `itinerary.legs[].durationInMinutes` | `legs[].durationInMinutes` |
| `itinerary.legs[].carriers.marketing` | `legs[].carriers.marketing` |
| `itinerary.legs[].stopCount` | `legs[].stopCount` |

**Files Modified:**
| File | Change |
|---|---|
| `supabase/functions/search-flights/index.ts` | Full rewrite to use SkyScanner RapidAPI |

