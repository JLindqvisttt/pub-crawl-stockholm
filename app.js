// App State
const state = {
    userLocation: null,
    locationName: '',
    currentSetupStep: 1,
    maxUnlockedStep: 1,
    settings: {
        stops: 5,
        priceLevel: 'budget',
        neighborhood: '',
        locationMode: 'gps'
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
    updateStepDots(1);
    updateStepNav(1);
    toggleLocationModeUI();
    initEventListeners();
    loadFromLocalStorage();
    if (!state.userLocation) {
        getUserLocationAuto();
    }
});

function initEventListeners() {
    // Setup screen
    document.getElementById('startRunBtn').addEventListener('click', () => startCrawl(state.randomMode));
    document.getElementById('toRouteStepBtn').addEventListener('click', () => advanceToStep(3, 2));
    document.getElementById('applyCustomLocationBtn').addEventListener('click', applyCustomLocation);
    
    // Option buttons
    document.querySelectorAll('.option-btn[data-stops]').forEach(btn => {
        btn.addEventListener('click', (e) => selectOption(e, 'stops'));
    });
    document.querySelectorAll('.option-btn[data-price]').forEach(btn => {
        btn.addEventListener('click', (e) => selectOption(e, 'price'));
    });
    document.querySelectorAll('.route-card-btn[data-route-mode]').forEach(btn => {
        btn.addEventListener('click', (e) => selectOption(e, 'routeMode'));
    });
    document.querySelectorAll('.option-btn[data-location-mode]').forEach(btn => {
        btn.addEventListener('click', (e) => selectOption(e, 'locationMode'));
    });
    document.querySelectorAll('.step-nav-btn[data-step-nav]').forEach(btn => {
        btn.addEventListener('click', onStepNavClick);
    });
    
    // Crawl screen
    document.getElementById('checkInBtn').addEventListener('click', checkIn);
    document.getElementById('openMapsBtn').addEventListener('click', openInMaps);
    document.getElementById('skipClosedBtn').addEventListener('click', skipClosedPub);
    document.getElementById('endCrawlBtn').addEventListener('click', endCrawl);
    
    // Group mode is intentionally disabled for now (single-leader flow only).
}

// ===== OPTION SELECTION =====
function selectOption(e, type) {
    if (type === 'routeMode') {
        const btn = e.target.closest('.route-card-btn');
        btn.closest('.route-mode-cards').querySelectorAll('.route-card-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.randomMode = btn.dataset.routeMode === 'random';
        return;
    }

    // Use currentTarget so clicks on child <span>/<small> still read the right dataset
    const clickedBtn = e.currentTarget;
    clickedBtn.parentElement.querySelectorAll('.option-btn').forEach(b => b.classList.remove('active'));
    clickedBtn.classList.add('active');

    if (type === 'stops') {
        state.settings.stops = parseInt(clickedBtn.dataset.stops);
    } else if (type === 'price') {
        state.settings.priceLevel = clickedBtn.dataset.price;
    } else if (type === 'locationMode') {
        state.settings.locationMode = clickedBtn.dataset.locationMode;
        toggleLocationModeUI();
        if (state.settings.locationMode === 'gps') {
            state.settings.neighborhood = '';
            if (state.userLocation) {
                updateLocationStatus('success', 'Redo att hoppa!', 'GPS hittad. Fortsätt till steg 2.');
                setTimeout(() => advanceToStep(2, 1), 220);
            } else {
                updateLocationStatus('loading', 'Hämtar din position...', '');
                getUserLocationAuto();
            }
        } else {
            state.userLocation = null;
            state.settings.neighborhood = '';
            updateLocationStatus('loading', 'Skriv in en plats och bekräfta', 'Adress eller stadsdel fungerar bra');
        }
    }
}

function advanceToStep(nextStep, fromStep) {
    state.maxUnlockedStep = Math.max(state.maxUnlockedStep, Math.min(nextStep, 3));
    state.currentSetupStep = nextStep;
    const overlay = document.getElementById('levelCompleteOverlay');
    document.getElementById('lcStepNum').textContent = fromStep;

    overlay.classList.remove('hidden');
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('lc-visible')));

    setTimeout(() => {
        if (nextStep <= 3) {
            showSetupStep(nextStep);
            updateStepDots(nextStep);
            updateStepNav(nextStep);
        }
    }, 620);

    setTimeout(() => overlay.classList.remove('lc-visible'), 780);
    setTimeout(() => overlay.classList.add('hidden'), 1080);
}

function showSetupStep(step) {
    document.querySelectorAll('.setup-step[data-step]').forEach(el => el.classList.add('step-hidden'));
    const target = document.querySelector(`.setup-step[data-step="${step}"]`);
    if (target) {
        target.classList.remove('step-hidden');
    }
    const summary = document.getElementById('setupSummary');
    if (summary) {
        summary.classList.add('step-hidden');
    }
    state.currentSetupStep = step;
}

function updateStepNav(activeStep) {
    document.querySelectorAll('.step-nav-btn[data-step-nav]').forEach((btn) => {
        const step = parseInt(btn.dataset.stepNav, 10);
        const locked = step > state.maxUnlockedStep;

        btn.classList.toggle('is-locked', locked);
        btn.classList.toggle('is-done', !locked && step < activeStep);
        btn.classList.toggle('is-active', !locked && step === activeStep);
        btn.disabled = locked;
    });
}

function onStepNavClick(e) {
    const step = parseInt(e.currentTarget.dataset.stepNav, 10);
    if (step > state.maxUnlockedStep) {
        return;
    }
    showSetupStep(step);
    updateStepDots(step);
    updateStepNav(step);
}

function updateStepDots(activeStep) {
    document.querySelectorAll('.sdot').forEach(dot => {
        const n = parseInt(dot.dataset.dot);
        dot.classList.toggle('sdot-active', n === activeStep);
        dot.classList.toggle('sdot-done', n < activeStep);
    });
}

function showSetupSummary() {
    document.querySelectorAll('.setup-step[data-step]').forEach(el => el.classList.add('step-hidden'));

    const summary = document.getElementById('setupSummary');
    if (summary) summary.classList.remove('step-hidden');

    const chips = document.getElementById('summaryChips');
    if (!chips) return;

    const stopLabels = { 3: '3 stopp', 5: '5 stopp', 7: '7 stopp' };
    const priceLabels = { budget: '💰 Budget', medium: '💎 Medium', all: '🃏 Alla' };
    const locationLabel = state.settings.locationMode === 'gps'
        ? '📍 Min plats'
        : '✏️ ' + (state.settings.neighborhood || 'Vald plats');

    chips.innerHTML = [
        locationLabel,
        stopLabels[state.settings.stops] || state.settings.stops + ' stopp',
        priceLabels[state.settings.priceLevel] || state.settings.priceLevel,
        state.randomMode ? '🎲 Överraskning' : '🎯 Smart rutt'
    ].map(t => `<span class="chip">${t}</span>`).join('');
}

function toggleLocationModeUI() {
    const customWrap = document.getElementById('customLocationWrapper');
    const isCustom = state.settings.locationMode === 'custom';
    customWrap.classList.toggle('hidden', !isCustom);
}

async function applyCustomLocation() {
    const query = document.getElementById('customLocationInput').value.trim();
    if (!query) {
        showError('Skriv in en plats innan du bekräftar.');
        return;
    }

    updateLocationStatus('loading', 'Söker efter plats...', query);
    showLoading();

    try {
        const endpoint = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
        const response = await fetch(endpoint);
        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            hideLoading();
            updateLocationStatus('error', 'Ingen plats hittades', 'Prova en tydligare adress eller stadsdel');
            showError('Kunde inte hitta platsen.');
            return;
        }

        const place = data[0];
        state.userLocation = {
            lat: parseFloat(place.lat),
            lng: parseFloat(place.lon)
        };
        state.settings.neighborhood = query;
        state.locationName = place.display_name.split(',').slice(0, 2).join(', ');
        updateLocationStatus('success', 'Plats vald!', state.locationName);
        hideLoading();
        showError('');
        if (state.currentSetupStep === 1) {
            advanceToStep(2, 1);
        }
    } catch (error) {
        hideLoading();
        updateLocationStatus('error', 'Fel vid platsval', 'Kontrollera anslutning och prova igen');
        showError('Kunde inte geokoda platsen just nu.');
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
        
        updateLocationStatus('success', 'Redo att hoppa!', `Du är i ${locationName}`);
    } catch (error) {
        updateLocationStatus('success', 'Redo att hoppa!', 'GPS hittad!');
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
    document.getElementById('currentPubDistance').textContent = `📍 ${pub.distanceFromPrevious} m`;
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
                <span class="detail">📍 ${pub.distanceFromPrevious} m från föregående</span>
                <span class="detail">⏱ ${pub.walkingTime} min</span>
            </div>
            ${isLocked ? '<p class="unlock-message">🔒 Låses upp efter nästa check-in</p>' : ''}
        `;
        
        container.appendChild(card);
    }
}

function skipClosedPub() {
    const removed = state.pubs.splice(state.currentStopIndex, 1)[0];
    state.skippedIds = state.skippedIds || [];
    state.skippedIds.push(removed.id);

    if (state.pubs.length === 0) {
        document.getElementById('currentPubCard').innerHTML = `
            <div style="text-align:center;padding:2rem 0;">
                <h2>Inga fler barer hittades</h2>
                <p>Testa att öka radien eller välj ett annat område.</p>
            </div>`;
        return;
    }

    updateProgress();
    displayCurrentPub();
    displayNextPubs();

    const card = document.getElementById('currentPubCard');
    card.style.animation = 'none';
    setTimeout(() => { card.style.animation = 'slideUp 0.5s'; }, 10);
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
            <h2 style="font-size: 2.2rem; margin-bottom: 1rem;">Klart</h2>
            <h2>Nattens hjälte</h2>
            <p>Du har klämt i alla stopp – det kallas kroghopp.</p>
            <button onclick="restartToSetup()" class="primary-btn large" style="margin-top: 2rem;">
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
        state.pubs = [];
        state.currentStopIndex = 0;
        state.checkedIn = [];
        switchScreen('setupScreen');
        resetSetupFlow();
    }
}

function resetSetupFlow() {
    state.currentSetupStep = 1;
    state.maxUnlockedStep = 1;
    state.settings.stops = 5;
    state.settings.priceLevel = 'budget';
    state.settings.locationMode = 'gps';
    state.randomMode = false;

    showSetupStep(1);
    updateStepDots(1);
    updateStepNav(1);

    document.getElementById('setupError').textContent = '';
    document.getElementById('levelCompleteOverlay').classList.add('hidden');
    document.getElementById('levelCompleteOverlay').classList.remove('lc-visible');

    // Reset setup option UI state.
    document.querySelectorAll('.option-btn[data-location-mode]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.locationMode === 'gps');
    });
    document.querySelectorAll('.option-btn[data-stops]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.stops === '5');
    });
    document.querySelectorAll('.option-btn[data-price]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.price === 'budget');
    });
    document.querySelectorAll('.route-card-btn[data-route-mode]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.routeMode === 'smart');
    });

    toggleLocationModeUI();

    if (state.userLocation) {
        updateLocationStatus('success', 'Redo att hoppa!', 'Tryck Min plats eller välj ett eget ställe.');
    } else {
        updateLocationStatus('loading', 'Hämtar din position...', '');
        getUserLocationAuto();
    }
}

function restartToSetup() {
    localStorage.removeItem('pubCrawlState');
    state.pubs = [];
    state.currentStopIndex = 0;
    state.checkedIn = [];
    switchScreen('setupScreen');
    resetSetupFlow();
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
                <small>Typ: ${formatPubType(pub.type)}</small><br>
                ${isCompleted ? '<span style="color: #06A77D;">Besökt</span>' : ''}
                ${isCurrent ? '<span style="color: #6366F1;">Nuvarande</span>' : ''}
                ${isNext ? '<span style="color: #A78BFA;">Nästa</span>' : ''}
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
                font-size: 14px;
                font-weight: 700;
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            ">
                S
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


