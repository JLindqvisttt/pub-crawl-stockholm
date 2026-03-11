async function findPubs() {
    const { lat, lng } = state.userLocation;
    const radius = 2000; // Search within 2km

    // Overpass query to find bars and pubs
    const query = `
        [out:json][timeout:25];
        (
            node["amenity"="bar"](around:${radius},${lat},${lng});
            node["amenity"="pub"](around:${radius},${lat},${lng});
            node["amenity"="nightclub"](around:${radius},${lat},${lng});
        );
        out body;
    `;

    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: query
        });

        const data = await response.json();

        // Process results
        const pubs = data.elements
            .filter(element => element.tags && element.tags.name)
            .map(element => ({
                id: element.id,
                name: element.tags.name,
                lat: element.lat,
                lon: element.lon,
                address: formatAddress(element.tags),
                type: element.tags.amenity,
                openingHours: element.tags.opening_hours,
                website: element.tags.website,
                tags: element.tags,
                distance: calculateDistance(lat, lng, element.lat, element.lon)
            }))
            .filter(pub => !isPermanentlyClosed(pub))
            .filter(pub => pub.distance <= 2000) // Within 2km
            .sort((a, b) => a.distance - b.distance);

        // Filter by price if budget (just take the closest ones as proxy for now)
        if (state.settings.priceLevel === 'budget') {
            // Budget: prioritize places closer to center/Sodermalm area
            state.pubs = pubs.slice(0, Math.min(pubs.length, 20));
        } else {
            state.pubs = pubs.slice(0, Math.min(pubs.length, 20));
        }
    } catch (error) {
        console.error('Error fetching pubs:', error);
        state.pubs = [];
    }
}

function isPermanentlyClosed(pub) {
    const tags = pub.tags || {};
    const opening = (pub.openingHours || '').toLowerCase().trim();

    // Explicit permanent closure in opening hours.
    if (opening === 'closed' || opening === 'off') {
        return true;
    }

    // Common OSM signals that a place is no longer operating.
    const closureTagKeys = [
        'disused',
        'abandoned',
        'demolished',
        'was:amenity',
        'disused:amenity',
        'abandoned:amenity',
        'removed:amenity'
    ];

    return closureTagKeys.some((key) => Object.prototype.hasOwnProperty.call(tags, key));
}
