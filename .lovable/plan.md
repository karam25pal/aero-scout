
# Plan: Switch to a Better Flight Data Provider for Full Results

## Problem Analysis

The current Booking.com RapidAPI provider has a critical limitation:
- It reports `totalCount: 70` or `87` flights available
- But it only returns ~15 results per request
- Pagination parameters (offset, page, cursor) are ignored - same 15 results returned every time
- "Load more" button never finds new flights because the API doesn't support real pagination

## Solution: Switch to SkyScanner RapidAPI

The **SkyScanner Flight Search** API on RapidAPI has proper pagination support and returns complete result sets. It's one of the most reliable flight search APIs with:
- Real pagination with session-based searches
- Access to all available flights (not just top 15)
- Same RAPIDAPI_KEY can be used (just different endpoint)

---

## Implementation Steps

### 1. Update Edge Function: `search-flights/index.ts`

Replace the Booking.com API calls with SkyScanner API:

**Changes:**
- Use SkyScanner's `searchFlights` endpoint which creates a search session
- Use `searchFlightsComplete` to poll until all results are loaded
- The API returns complete paginated results
- Keep the same response format for frontend compatibility

**New API Flow:**
```text
1. Call searchFlights to create session
2. Poll searchFlightsComplete until status="complete"
3. Return ALL itineraries (not limited to 15)
```

### 2. Update Response Transformation

- Map SkyScanner's response format to our existing `FlightResult` interface
- SkyScanner uses different field names (itineraries, legs, pricing)
- Maintain backward compatibility with frontend

### 3. Remove "Load More" Logic (Optional)

Since we'll now return all flights in one response:
- The "Load more" button becomes unnecessary
- Or keep it for future use with very large result sets

---

## Technical Details

### SkyScanner API Endpoints (RapidAPI)

```text
Host: sky-scanner3.p.rapidapi.com

GET /flights/search-one-way
  ?fromEntityId=LOND
  &toEntityId=NYCA  
  &departDate=2026-02-20
  &adults=1
  &cabinClass=economy
  &currency=GBP

Returns: Complete list of itineraries with proper pagination
```

### Response Mapping

| SkyScanner Field | Our Field |
|------------------|-----------|
| `itineraries` | `flightOffers` |
| `itinerary.price.raw` | `price.raw` |
| `itinerary.legs` | `legs` |
| `leg.origin.displayCode` | `origin.displayCode` |
| `leg.carriers.marketing` | `carriers.marketing` |

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/search-flights/index.ts` | Replace API calls, update transformation logic |
| `src/components/FlightResults.tsx` | Optionally hide "Load more" if all results returned |
| `src/pages/Index.tsx` | Simplify by removing pagination state (optional) |

---

## Alternative Option

If you prefer to keep using Booking.com API, we can implement a workaround:
- Make 3 parallel calls with different `sort` values (BEST, CHEAPEST, FASTEST)
- Merge and deduplicate results
- This typically yields ~30-40 unique flights (better than 15, but not the full 87)

---

## Summary

Switching to SkyScanner API will give you access to all available flights because it has real pagination support. The change is primarily in the backend edge function - the frontend will work with minimal changes.
