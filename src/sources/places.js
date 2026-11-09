// Google Places API (New) Text Search adapter. Enabled when GOOGLE_PLACES_API_KEY is set.
// Maps results to partial leads; fields Places can't know (employees, booking, chat…) stay default
// and should be enriched by a rep or a later enrichment step.
const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.addressComponents';

export const placesEnabled = () => !!process.env.GOOGLE_PLACES_API_KEY;

export async function searchPlaces({ query, city }, fetchImpl = fetch) {
  const res = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY, 'X-Goog-FieldMask': FIELD_MASK },
    body: JSON.stringify({ textQuery: `${query} in ${city}, TX`, maxResultCount: 20 }),
  });
  if (!res.ok) throw new Error(`Places API ${res.status}`);
  const { places = [] } = await res.json();
  return places.map((p) => ({
    external_id: `gplaces:${p.id}`,
    name: p.displayName?.text,
    address: p.formattedAddress,
    phone: p.nationalPhoneNumber,
    website: p.websiteUri,
    rating: p.rating,
    review_count: p.userRatingCount,
    city: p.addressComponents?.find((c) => c.types?.includes('locality'))?.longText ?? city,
    source: 'google_places',
  }));
}
