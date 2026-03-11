function calculateDistance(lat1, lon1, lat2, lon2) {
    // Haversine formula
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}

function formatAddress(tags) {
    const parts = [];
    if (tags['addr:street']) parts.push(tags['addr:street']);
    if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
    return parts.length > 0 ? parts.join(' ') : 'Stockholm';
}

function formatPubType(type) {
    const types = {
        bar: 'Bar',
        pub: 'Pub',
        nightclub: 'Nightclub',
        biergarten: 'Beer Garden',
        tavern: 'Tavern'
    };
    return types[type] || 'Bar';
}

function getPubTypeIcon(type) {
    const icons = {
        bar: '🍺',
        pub: '🍻',
        nightclub: '💃',
        biergarten: '🍻',
        tavern: '🍺'
    };
    return icons[type] || '🍺';
}

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}
