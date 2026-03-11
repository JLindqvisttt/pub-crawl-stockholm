// App State
const state = {
    userLocation: null,
    settings: {
        stops: 5,
        priceLevel: 'budget',
        neighborhood: ''
    },
    pubs: [],
    currentStopIndex: 0,
    checkedIn: [],
    groupMode: false,
    groupCode: null,
    groupMembers: [],
    randomMode: false
};

// Map instance
let map = null;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    loadFromLocalStorage();
    
    // Auto-start GPS on load
    if (!state.userLocation) {
        getUserLocationAuto();
    }
});

function initEventListeners() {
    // Setup screen
    document.getElementById('startCrawlBtn').addEventListener('click', () => startCrawl(false));
    document.getElementById('randomCrawlBtn').addEventListener('click', () => startCrawl(true));
    
    // Option buttons
    document.querySelectorAll('.option-btn[data-stops]').forEach(btn => {
        btn.addEventListener('click', (e) => selectOption(e, 'stops'));
    });
    document.querySelectorAll('.option-btn[data-price]').forEach(btn => {
        btn.addEventListener('click', (e) => selectOption(e, 'price'));
    });
    
    // Crawl screen
    document.getElementById('checkInBtn').addEventListener('click', checkIn);
    document.getElementById('openMapsBtn').addEventListener('click', openInMaps);
    document.getElementById('endCrawlBtn').addEventListener('click', endCrawl);
    
    // Group mode
    document.getElementById('groupModeBtn').addEventListener('click', openGroupModal);
    document.querySelector('.close').addEventListener('click', closeGroupModal);
    document.getElementById('createGroupBtn').addEventListener('click', createGroup);
    document.getElementById('joinGroupBtn').addEventListener('click', () => {
        document.getElementById('createGroupSection').classList.add('hidden');
        document.getElementById('joinGroupSection').classList.remove('hidden');
    });
    document.getElementById('joinGroupSubmitBtn').addEventListener('click', joinGroup);
    document.getElementById('copyCodeBtn').addEventListener('click', copyGroupCode);
}

// ===== OPTION SELECTION =====
function selectOption(e, type) {
    const buttons = e.target.parentElement.querySelectorAll('.option-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    
    if (type === 'stops') {
        state.settings.stops = parseInt(e.target.dataset.stops);
    } else if (type === 'price') {
        state.settings.priceLevel = e.target.dataset.price;
    }
}

// ===== GEOLOCATION =====
function getUserLocationAuto() {
    updateLocationStatus('loading', 'Hämtar din position...', '');
    
    if (!navigator.geolocation) {
        updateLocationStatus('error', 'GPS stöds inte', 'Din webbläsare saknar GPS-stöd');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            state.userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            // Get address name
            reverseGeocode(position.coords.latitude, position.coords.longitude);
            
            document.getElementById('startCrawlBtn').disabled = false;
            document.getElementById('randomCrawlBtn').disabled = false;
            document.getElementById('setupError').textContent = '';
        },
        (error) => {
            let errorMsg = 'Kunde inte hämta position';
            let detail = 'Tillåt platsåtkomst i webbläsaren';
            
            if (error.code === 1) {
                detail = 'Du nekade platsåtkomst. Aktivera i webbläsarinställningar.';
            } else if (error.code === 2) {
                detail = 'Position otillgänglig. Kontrollera anslutningen.';
            } else if (error.code === 3) {
                detail = 'Timeout – försök igen.';
            }
            
            updateLocationStatus('error', errorMsg, detail);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

function updateLocationStatus(status, text, detail) {
    const statusEl = document.getElementById('locationStatus');
    const textEl = document.getElementById('locationText');
    const detailEl = document.getElementById('locationDetail');
    
    statusEl.className = 'location-status ' + status;
    textEl.textContent = text;
    detailEl.textContent = detail;
}

async function reverseGeocode(lat, lng) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
        );
        const data = await response.json();
        
        const address = data.address;
        let locationName = 'Stockholm';
        
        if (address.suburb) {
            locationName = address.suburb;
        } else if (address.neighbourhood) {
            locationName = address.neighbourhood;
        } else if (address.city_district) {
            locationName = address.city_district;
        }
        
        updateLocationStatus('success', '✓ Redo att hoppa!', `Du är i ${locationName}`);
    } catch (error) {
        updateLocationStatus('success', '✓ Redo att hoppa!', 'GPS hittad!');
    }
}

function showError(message) {
    document.getElementById('setupError').textContent = message;
}

// ===== START CRAWL =====
async function startCrawl(randomize = false) {
    // Validate location
    if (!state.userLocation) {
        showError('Väntar på GPS-position...');
        getUserLocationAuto();
        return;
    }
    
    state.randomMode = randomize;
    
    // Get neighborhood filter
    state.settings.neighborhood = document.getElementById('neighborhoodFilter').value;
    
    // Show loading
    showLoading();
    
    try {
        // Find pubs using Overpass API
        await findPubs();
        
        if (state.pubs.length === 0) {
            hideLoading();
            showError('Inga krogar hittades i närheten. Prova ett annat område.');
            return;
        }
        
        // Optimize route
        optimizeRoute();
        
        // Switch to crawl screen
        hideLoading();
        switchScreen('crawlScreen');
        
        // Initialize crawl UI
        initCrawlScreen();
        
        // Save to localStorage
        saveToLocalStorage();
        
    } catch (error) {
        console.error('Error starting crawl:', error);
        hideLoading();
        showError('Ett fel uppstod. Försök igen.');
    }
}

// ===== FIND PUBS USING OVERPASS API =====
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
                distance: calculateDistance(lat, lng, element.lat, element.lon)
            }))
            .filter(pub => pub.distance <= 2000) // Within 2km
            .sort((a, b) => a.distance - b.distance);
        
        // Filter by price if budget (just take the closest ones as proxy for now)
        if (state.settings.priceLevel === 'budget') {
            // Budget: prioritize places closer to center/Södermalm area
            state.pubs = pubs.slice(0, Math.min(pubs.length, 20));
        } else {
            state.pubs = pubs.slice(0, Math.min(pubs.length, 20));
        }
        
    } catch (error) {
        console.error('Error fetching pubs:', error);
        state.pubs = [];
    }
}

// ===== ROUTE OPTIMIZATION =====
function optimizeRoute() {
    if (state.pubs.length === 0) return;
    
    const numStops = Math.min(state.settings.stops, state.pubs.length);
    const selected = [];
    
    if (state.randomMode) {
        // Random mode: shuffle and pick random pubs
        const shuffled = [...state.pubs].sort(() => Math.random() - 0.5);
        for (let i = 0; i < numStops && i < shuffled.length; i++) {
            selected.push(shuffled[i]);
        }
    } else {
        // Optimized mode: greedy algorithm for shortest path
        let currentPos = state.userLocation;
        let available = [...state.pubs];
        
        for (let i = 0; i < numStops; i++) {
            if (available.length === 0) break;
            
            // Find closest pub to current position
            let closestIndex = 0;
            let minDist = Infinity;
            
            available.forEach((pub, index) => {
                const dist = calculateDistance(currentPos.lat, currentPos.lng, pub.lat, pub.lon);
                if (dist < minDist && dist >= 100) { // At least 100m apart
                    minDist = dist;
                    closestIndex = index;
                }
            });
            
            const selectedPub = available[closestIndex];
            selected.push(selectedPub);
            currentPos = { lat: selectedPub.lat, lng: selectedPub.lon };
            available.splice(closestIndex, 1);
        }
    }
    
    // Calculate distances between stops
    selected.forEach((pub, index) => {
        if (index === 0) {
            pub.distanceFromPrevious = calculateDistance(
                state.userLocation.lat, 
                state.userLocation.lng, 
                pub.lat, 
                pub.lon
            );
        } else {
            pub.distanceFromPrevious = calculateDistance(
                selected[index - 1].lat,
                selected[index - 1].lon,
                pub.lat,
                pub.lon
            );
        }
        pub.walkingTime = Math.ceil(pub.distanceFromPrevious / 80); // ~80m/min walking speed
    });
    
    state.pubs = selected;
}

// ===== CRAWL SCREEN =====
function initCrawlScreen() {
    state.currentStopIndex = 0;
    state.checkedIn = [];
    
    updateProgress();
    displayCurrentPub();
    displayNextPubs();
    initMap();
}

function updateProgress() {
    const progress = (state.checkedIn.length / state.pubs.length) * 100;
    document.getElementById('progressFill').style.width = `${progress}%`;
    document.getElementById('currentStop').textContent = state.checkedIn.length;
    document.getElementById('totalStops').textContent = state.pubs.length;
}

function displayCurrentPub() {
    if (state.currentStopIndex >= state.pubs.length) {
        completeCrawl();
        return;
    }
    
    const pub = state.pubs[state.currentStopIndex];
    
    document.getElementById('currentPubName').textContent = pub.name;
    document.getElementById('currentPubAddress').textContent = pub.address || 'Stockholm';
    document.getElementById('currentPubDistance').textContent = `📍 ${pub.distanceFromPrevious}m`;
    document.getElementById('currentPubTime').textContent = `⏱ ${pub.walkingTime} min`;
    document.getElementById('currentPubType').textContent = `🏷️ ${formatPubType(pub.type)}`;
    
    // Update pub type icon
    const icon = getPubTypeIcon(pub.type);
    document.getElementById('currentPubTypeIcon').textContent = icon;
    
    updateMap();
}

function displayNextPubs() {
    const container = document.getElementById('nextPubsContainer');
    container.innerHTML = '';
    
    for (let i = state.currentStopIndex + 1; i < state.pubs.length; i++) {
        const pub = state.pubs[i];
        const isLocked = i > state.currentStopIndex + 1;
        
        const card = document.createElement('div');
        card.className = `card next-pub-card ${isLocked ? 'locked-pub' : ''}`;
        
        card.innerHTML = `
            <h3>Stopp ${i + 1}: ${pub.name}</h3>
            <p class="pub-address">${pub.address || 'Stockholm'}</p>
            <div class="pub-details">
                <span class="detail">📍 ${pub.distanceFromPrevious}m från föregående</span>
                <span class="detail">⏱ ${pub.walkingTime} min</span>
            </div>
            ${isLocked ? '<p class="unlock-message">🔒 Låses upp efter nästa check-in</p>' : ''}
        `;
        
        container.appendChild(card);
    }
}

function getPubTypeIcon(type) {
    const icons = {
        'bar': '🍺',
        'pub': '🍻',
        'nightclub': '💃',
        'biergarten': '🍻',
        'tavern': '🍺'
    };
    return icons[type] || '🍺';
}

function formatPubType(type) {
    const types = {
        'bar': 'Bar',
        'pub': 'Pub',
        'nightclub': 'Nightclub',
        'biergarten': 'Beer Garden',
        'tavern': 'Tavern'
    };
    return types[type] || 'Bar';
}

function checkIn() {
    const currentPub = state.pubs[state.currentStopIndex];
    state.checkedIn.push(currentPub.id);
    state.currentStopIndex++;
    
    updateProgress();
    
    if (state.currentStopIndex < state.pubs.length) {
        displayCurrentPub();
        displayNextPubs();
        
        // Animate card
        const card = document.getElementById('currentPubCard');
        card.style.animation = 'none';
        setTimeout(() => {
            card.style.animation = 'slideUp 0.5s';
        }, 10);
    } else {
        completeCrawl();
    }
    
    // Update group if in group mode
    if (state.groupMode) {
        updateGroupProgress();
    }
    
    saveToLocalStorage();
}

function completeCrawl() {
    document.getElementById('currentPubCard').innerHTML = `
        <div style="text-align: center; padding: 2rem 0;">
            <h2 style="font-size: 3rem; margin-bottom: 1rem;">🎉</h2>
            <h2>Nattens hjälte!</h2>
            <p>Du har klämt i alla stopp – det kallas kroghopp.</p>
            <button onclick="location.reload()" class="primary-btn large" style="margin-top: 2rem;">
                Starta nytt hopp
            </button>
        </div>
    `;
    document.getElementById('nextPubsContainer').innerHTML = '';
}

function openInMaps() {
    const pub = state.pubs[state.currentStopIndex];
    const url = `https://www.google.com/maps/dir/?api=1&destination=${pub.lat},${pub.lon}`;
    window.open(url, '_blank');
}

function endCrawl() {
    if (confirm('Avsluta och gå hem? 😔')) {
        localStorage.removeItem('pubCrawlState');
        switchScreen('setupScreen');
        state.pubs = [];
        state.currentStopIndex = 0;
        state.checkedIn = [];
    }
}

// ===== MAP =====
function initMap() {
    if (map) {
        map.remove();
    }
    
    map = L.map('map').setView([state.userLocation.lat, state.userLocation.lng], 14);
    
    // Dark mode tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap, © CartoDB',
        maxZoom: 19
    }).addTo(map);
    
    updateMap();
}

function updateMap() {
    if (!map) return;
    
    const currentPub = state.pubs[state.currentStopIndex];
    const prevPub = state.currentStopIndex > 0 
        ? state.pubs[state.currentStopIndex - 1] 
        : state.userLocation;
    
    // Clear markers and lines
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
    });
    
    // Add ALL pub markers with numbers
    const allPoints = [];
    
    state.pubs.forEach((pub, index) => {
        const isCompleted = index < state.currentStopIndex;
        const isCurrent = index === state.currentStopIndex;
        const isNext = index === state.currentStopIndex + 1;
        
        let markerColor = '#666666'; // Future stops
        let numberBg = '#444444';
        
        if (isCompleted) {
            markerColor = '#06A77D'; // Completed
            numberBg = '#06A77D';
        } else if (isCurrent) {
            markerColor = '#FF6B35'; // Current
            numberBg = '#FF6B35';
        } else if (isNext) {
            markerColor = '#FFA500'; // Next
            numberBg = '#FFA500';
        }
        
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `
                <div style="
                    background: ${numberBg};
                    color: white;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 14px;
                    border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    ${isCurrent ? 'animation: markerPulse 2s infinite;' : ''}
                ">
                    ${index + 1}
                </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
        
        const marker = L.marker([pub.lat, pub.lon], { icon })
            .addTo(map)
            .bindPopup(`
                <b>${index + 1}. ${pub.name}</b><br>
                ${pub.address || 'Stockholm'}<br>
                <small>${getPubTypeIcon(pub.type)} ${formatPubType(pub.type)}</small><br>
                ${isCompleted ? '<span style="color: #06A77D;">✓ Besökt</span>' : ''}
                ${isCurrent ? '<span style="color: #FF6B35;">⭐ Nuvarande</span>' : ''}
                ${isNext ? '<span style="color: #FFA500;">→ Nästa</span>' : ''}
            `);
        
        if (isCurrent) {
            marker.openPopup();
        }
        
        allPoints.push([pub.lat, pub.lon]);
    });
    
    // Add start marker
    const startIcon = L.divIcon({
        className: 'custom-marker',
        html: `
            <div style="
                background: #4CAF50;
                color: white;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            ">
                📍
            </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
    });
    
    L.marker([state.userLocation.lat, state.userLocation.lng], { icon: startIcon })
        .addTo(map)
        .bindPopup('<b>Start</b><br>Din position');
    
    // Draw route lines
    const routePoints = [
        [state.userLocation.lat, state.userLocation.lng],
        ...allPoints
    ];
    
    // Completed path (green)
    if (state.currentStopIndex > 0) {
        const completedPath = [
            [state.userLocation.lat, state.userLocation.lng],
            ...state.pubs.slice(0, state.currentStopIndex).map(p => [p.lat, p.lon])
        ];
        L.polyline(completedPath, { 
            color: '#06A77D', 
            weight: 4, 
            opacity: 0.8,
            dashArray: '10, 5'
        }).addTo(map);
    }
    
    // Current segment (orange)
    const prevLat = prevPub.lat || prevPub.lat;
    const prevLng = prevPub.lon || prevPub.lng;
    
    L.polyline([
        [prevLat, prevLng],
        [currentPub.lat, currentPub.lon]
    ], { 
        color: '#FF6B35', 
        weight: 5, 
        opacity: 0.9
    }).addTo(map);
    
    // Future path (gray)
    if (state.currentStopIndex < state.pubs.length - 1) {
        const futurePath = state.pubs.slice(state.currentStopIndex).map(p => [p.lat, p.lon]);
        L.polyline(futurePath, { 
            color: '#666666', 
            weight: 3, 
            opacity: 0.4,
            dashArray: '5, 10'
        }).addTo(map);
    }
    
    // Fit bounds to show all points
    const bounds = L.latLngBounds([
        [state.userLocation.lat, state.userLocation.lng],
        ...allPoints
    ]);
    map.fitBounds(bounds, { padding: [30, 30] });
}

// Add CSS for marker pulse animation
const style = document.createElement('style');
style.textContent = `
    @keyframes markerPulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.9; }
    }
`;
document.head.appendChild(style);

// ===== GROUP MODE =====
function openGroupModal() {
    document.getElementById('groupModal').classList.add('active');
}

function closeGroupModal() {
    document.getElementById('groupModal').classList.remove('active');
}

function createGroup() {
    const code = generateGroupCode();
    state.groupCode = code;
    state.groupMode = true;
    state.groupMembers = [{ name: 'Du', checkedIn: state.checkedIn }];
    
    document.getElementById('groupCode').textContent = code;
    document.getElementById('createGroupSection').classList.remove('hidden');
    document.getElementById('joinGroupSection').classList.add('hidden');
    document.getElementById('groupMembersSection').classList.remove('hidden');
    
    updateGroupMembersList();
    saveGroupToLocalStorage();
}

function joinGroup() {
    const code = document.getElementById('groupCodeInput').value.toUpperCase().trim();
    if (code.length !== 6) {
        alert('Ogiltig gruppkod');
        return;
    }
    
    // Load group from localStorage
    const groupData = localStorage.getItem(`group_${code}`);
    if (!groupData) {
        alert('Grupp hittades inte');
        return;
    }
    
    const group = JSON.parse(groupData);
    state.groupCode = code;
    state.groupMode = true;
    state.pubs = group.pubs;
    state.groupMembers = group.members;
    state.groupMembers.push({ name: 'Du', checkedIn: state.checkedIn });
    
    document.getElementById('groupMembersSection').classList.remove('hidden');
    updateGroupMembersList();
    saveGroupToLocalStorage();
    closeGroupModal();
    
    // If group has started, go to crawl screen
    if (state.pubs.length > 0) {
        switchScreen('crawlScreen');
        initCrawlScreen();
    }
}

function generateGroupCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function copyGroupCode() {
    const code = document.getElementById('groupCode').textContent;
    navigator.clipboard.writeText(code).then(() => {
        alert('Gruppkod kopierad! 🍻');
    });
}

function updateGroupMembersList() {
    const list = document.getElementById('groupMembersList');
    list.innerHTML = '';
    
    state.groupMembers.forEach(member => {
        const item = document.createElement('div');
        item.className = 'member-item';
        
        const checkedInCount = member.checkedIn.length;
        const statusClass = checkedInCount > 0 ? 'checked-in' : '';
        
        item.innerHTML = `
            <span>${member.name}</span>
            <span class="member-status ${statusClass}">
                ${checkedInCount}/${state.pubs.length} checkat in
            </span>
        `;
        
        list.appendChild(item);
    });
}

function updateGroupProgress() {
    // Update your progress in the group
    const yourMember = state.groupMembers.find(m => m.name === 'Du');
    if (yourMember) {
        yourMember.checkedIn = state.checkedIn;
    }
    
    saveGroupToLocalStorage();
}

function saveGroupToLocalStorage() {
    if (!state.groupCode) return;
    
    const groupData = {
        pubs: state.pubs,
        members: state.groupMembers,
        createdAt: Date.now()
    };
    
    localStorage.setItem(`group_${state.groupCode}`, JSON.stringify(groupData));
}

// ===== UTILITY FUNCTIONS =====
function calculateDistance(lat1, lon1, lat2, lon2) {
    // Haversine formula
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c);
}

function formatAddress(tags) {
    const parts = [];
    if (tags['addr:street']) parts.push(tags['addr:street']);
    if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
    return parts.length > 0 ? parts.join(' ') : 'Stockholm';
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

// ===== LOCAL STORAGE =====
function saveToLocalStorage() {
    const data = {
        userLocation: state.userLocation,
        settings: state.settings,
        pubs: state.pubs,
        currentStopIndex: state.currentStopIndex,
        checkedIn: state.checkedIn,
        groupMode: state.groupMode,
        groupCode: state.groupCode
    };
    localStorage.setItem('pubCrawlState', JSON.stringify(data));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('pubCrawlState');
    if (saved) {
        const data = JSON.parse(saved);
        
        // Only restore if crawl is in progress
        if (data.pubs && data.pubs.length > 0 && data.currentStopIndex < data.pubs.length) {
            if (confirm('Du har ett pågående hopp. Fortsätta?')) {
                Object.assign(state, data);
                switchScreen('crawlScreen');
                initCrawlScreen();
            } else {
                localStorage.removeItem('pubCrawlState');
            }
        }
    }
}
