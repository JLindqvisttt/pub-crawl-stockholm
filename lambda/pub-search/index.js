const { GeoPlacesClient, SearchNearbyCommand, SearchTextCommand } = require('@aws-sdk/client-geo-places');

const client = new GeoPlacesClient({});

const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event) => {
    // Handle CORS preflight
    if (event.requestContext?.http?.method === 'OPTIONS') {
        return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    }

    const params = event.queryStringParameters || {};
    const lat = parseFloat(params.lat);
    const lng = parseFloat(params.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'lat and lng query parameters are required' })
        };
    }

    try {
        // Try SearchNearby with bar/pub category filter first
        let venues = [];
        try {
            venues = await searchNearby(lat, lng);
        } catch (nearbyErr) {
            console.warn('SearchNearby failed, falling back to SearchText:', nearbyErr.message);
        }

        // Fall back to SearchText if SearchNearby returns nothing or errored
        if (venues.length === 0) {
            console.log('Using SearchText fallback');
            venues = await searchByText(lat, lng);
        }

        console.log(`Returning ${venues.length} venues for (${lat}, ${lng})`);
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(venues) };
    } catch (err) {
        console.error('geo-places error:', err);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Failed to fetch venues' })
        };
    }
};

async function searchNearby(lat, lng) {
    const cmd = new SearchNearbyCommand({
        QueryPosition: [lng, lat], // GeoJSON order: [longitude, latitude]
        QueryRadius: 2000,
        MaxResults: 50,
        Filter: {
            IncludeCategories: ['bar_or_pub']
        }
    });
    const res = await client.send(cmd);
    return mapItems(res.ResultItems || [], lat, lng);
}

async function searchByText(lat, lng) {
    // Run two queries in parallel and merge
    const [barsRes, pubsRes] = await Promise.all([
        client.send(new SearchTextCommand({
            QueryText: 'bar',
            BiasPosition: [lng, lat],
            QueryRadius: 2000,
            MaxResults: 30
        })),
        client.send(new SearchTextCommand({
            QueryText: 'pub nightclub',
            BiasPosition: [lng, lat],
            QueryRadius: 2000,
            MaxResults: 20
        }))
    ]);

    const allItems = [
        ...(barsRes.ResultItems || []),
        ...(pubsRes.ResultItems || [])
    ];

    // Deduplicate by PlaceId
    const seen = new Set();
    const unique = allItems.filter(item => {
        if (!item.PlaceId || seen.has(item.PlaceId)) return false;
        seen.add(item.PlaceId);
        return true;
    });

    // Filter to bar-like categories only
    const barItems = unique.filter(item =>
        (item.Categories || []).some(c => isBarCategory(c.Name))
    );

    return mapItems(barItems, lat, lng);
}

function isBarCategory(name) {
    const n = (name || '').toLowerCase();
    return n.includes('bar') || n.includes('pub') || n.includes('nightclub') ||
           n.includes('nightlife') || n.includes('brewery') || n.includes('lounge') ||
           n.includes('tavern') || n.includes('wine');
}

function mapItems(items, originLat, originLng) {
    return items
        .filter(item => item.Position && item.Title)
        .map(item => {
            const [lon, lat] = item.Position;
            const cats = (item.Categories || []).map(c => (c.Name || '').toLowerCase());
            const type = cats.some(c => c.includes('nightclub'))
                ? 'nightclub'
                : cats.some(c => c.includes('pub') || c.includes('tavern'))
                    ? 'pub'
                    : 'bar';

            const streetParts = [
                item.Address?.Street,
                item.Address?.AddressNumber
            ].filter(Boolean);
            const address = streetParts.length > 0
                ? streetParts.join(' ')
                : (item.Address?.Locality || 'Stockholm');

            return {
                id: `aws-${item.PlaceId}`,
                name: item.Title,
                lat,
                lon,
                address,
                type,
                openStatus: 'unknown',
                priceBucket: 'mid',
                confidenceScore: 80,
                distance: item.Distance != null
                    ? Math.round(item.Distance)
                    : Math.round(haversine(originLat, originLng, lat, lon))
            };
        });
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
