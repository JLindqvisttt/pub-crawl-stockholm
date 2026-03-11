// App State
const appConfig = window.APP_CONFIG || {};

const state = {
    userLocation: null,
    locationName: '',
    currentSetupStep: 1,
    maxUnlockedStep: 1,
    settings: {
        stops: 5,
        priceLevel: 'budget',
        neighborhood: '',
        locationMode: 'gps',
        openNowOnly: true
    },
    availablePubs: [],
    planBCandidates: [],
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
let currentPubCardTemplate = '';
let googlePlacesLoaderPromise = null;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    const cardEl = document.getElementById('currentPubCard');
    if (cardEl) {
        currentPubCardTemplate = cardEl.innerHTML;
    }

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
    const openNowToggle = document.getElementById('openNowToggle');
    if (openNowToggle) {
        openNowToggle.addEventListener('change', (e) => {
            state.settings.openNowOnly = e.target.checked;
        });
    }
    
    // Crawl screen
    bindCrawlActionButtons();
    document.getElementById('endCrawlBtn').addEventListener('click', endCrawl);
    const closePlanBBtn = document.getElementById('closePlanBBtn');
    if (closePlanBBtn) {
        closePlanBBtn.addEventListener('click', closePlanBModal);
    }
    
    // Group mode is intentionally disabled for now (single-leader flow only).
}

function bindCrawlActionButtons() {
    const checkInBtn = document.getElementById('checkInBtn');
    const planBBtn = document.getElementById('planBBtn');
    const openMapsBtn = document.getElementById('openMapsBtn');

    if (checkInBtn) checkInBtn.onclick = checkIn;
    if (planBBtn) planBBtn.onclick = usePlanB;
    if (openMapsBtn) openMapsBtn.onclick = openInMaps;
}

// ===== OPTION SELECTION =====
function selectOption(e, type) {
    if (type === 'routeMode') {
        const btn = e.target.closest('.route-card-btn');
        btn.closest('.route-mode-cards').querySelectorAll('.route-card-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.randomMode = btn.dataset.routeMode === 'random';
        setTimeout(() => advanceToStep(5, 4), 350);
        return;
    }

    // Use currentTarget so clicks on child <span>/<small> still read the right dataset
    const clickedBtn = e.currentTarget;
    clickedBtn.parentElement.querySelectorAll('.option-btn').forEach(b => b.classList.remove('active'));
    clickedBtn.classList.add('active');

    if (type === 'stops') {
        state.settings.stops = parseInt(clickedBtn.dataset.stops);
        setTimeout(() => advanceToStep(3, 2), 350);
    } else if (type === 'price') {
        state.settings.priceLevel = clickedBtn.dataset.price;
        setTimeout(() => advanceToStep(4, 3), 350);
    } else if (type === 'locationMode') {
        state.settings.locationMode = clickedBtn.dataset.locationMode;
        toggleLocationModeUI();
        if (state.settings.locationMode === 'gps') {
            state.settings.neighborhood = '';
            if (state.userLocation) {
                updateLocationStatus('success', 'Redo att hoppa!', 'GPS hittad. Fortsatt till steg 2.');
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
    state.maxUnlockedStep = Math.max(state.maxUnlockedStep, Math.min(nextStep, 4));
    state.currentSetupStep = nextStep;
    const overlay = document.getElementById('levelCompleteOverlay');
    document.getElementById('lcStepNum').textContent = fromStep;

    overlay.classList.remove('hidden');
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('lc-visible')));

    setTimeout(() => {
        if (nextStep <= 4) {
            showSetupStep(nextStep);
            updateStepDots(nextStep);
            updateStepNav(nextStep);
        } else {
            showSetupSummary();
            // All dots done
            document.querySelectorAll('.sdot').forEach(d => {
                d.classList.remove('sdot-active');
                d.classList.add('sdot-done');
            });
            updateStepNav(4);
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
    const priceLabels = { budget: 'Låg', medium: 'Mellan', all: 'Alla' };
    const locationLabel = state.settings.locationMode === 'gps'
        ? '📍 Min plats'
        : '✏️ ' + (state.settings.neighborhood || 'Vald plats');

    chips.innerHTML = [
        locationLabel,
        stopLabels[state.settings.stops] || state.settings.stops + ' stopp',
        priceLabels[state.settings.priceLevel] || state.settings.priceLevel,
        state.settings.openNowOnly ? '🕒 Oppet nu' : '🕒 Alla oppettider',
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
        showError('Skriv in en plats innan du bekraftar.');
        return;
    }

    updateLocationStatus('loading', 'Soker efter plats...', query);
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

// ===== FIND PUBS USING OVERPASS API =====
async function findPubs() {
    const { lat, lng } = state.userLocation;
    let pubs = [];

    // 1. Try AWS (Amazon Location Places V2) - most accurate
    if (appConfig.awsVenueEndpoint) {
        try {
            pubs = await findPubsWithAws(lat, lng);
        } catch (error) {
            console.warn('AWS venue search unavailable, trying next source:', error);
        }
    }

    // 2. Fall back to Google Places if configured
    if (pubs.length === 0) {
        try {
            pubs = await findPubsWithGooglePlaces(lat, lng);
        } catch (error) {
            console.warn('Google Places unavailable, falling back to OSM:', error);
        }
    }

    // 3. Last resort: OSM/Overpass
    if (pubs.length === 0) {
        try {
            pubs = await findPubsWithOsm(lat, lng);
        } catch (error) {
            console.error('Error fetching pubs:', error);
            state.availablePubs = [];
            state.pubs = [];
            return;
        }
    }

    // Optional filter: keep only places that are either open now or unknown state.
    const openFiltered = state.settings.openNowOnly
        ? pubs.filter(pub => pub.openStatus !== 'closed')
        : pubs;
    const priceFiltered = filterPubsByPrice(openFiltered, state.settings.priceLevel);

    state.availablePubs = priceFiltered.slice(0, Math.min(priceFiltered.length, 30));
    state.pubs = [...state.availablePubs];
}

// ===== ROUTE OPTIMIZATION =====
function optimizeRoute() {
    if (state.availablePubs.length === 0) return;
    
    const numStops = Math.min(state.settings.stops, state.availablePubs.length);
    const selected = [];
    const pool = [...state.availablePubs];
    
    if (state.randomMode) {
        // Random mode: shuffle and pick random pubs
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        for (let i = 0; i < numStops && i < shuffled.length; i++) {
            selected.push(shuffled[i]);
        }
    } else {
        // Optimized mode: greedy algorithm for shortest path
        let currentPos = state.userLocation;
        let available = [...pool];
        
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
    
    recomputeRouteMetrics(selected);
    state.pubs = selected;
}

// ===== CRAWL SCREEN =====
function initCrawlScreen() {
    ensureCurrentPubCardTemplate();
    state.currentStopIndex = 0;
    state.checkedIn = [];
    
    updateProgress();
    displayCurrentPub();
    displayNextPubs();
    initMap();
}

function ensureCurrentPubCardTemplate() {
    const cardEl = document.getElementById('currentPubCard');
    if (!cardEl) return;

    // Always restore the original card markup before a new crawl starts.
    if (currentPubCardTemplate) {
        cardEl.innerHTML = currentPubCardTemplate;
        bindCrawlActionButtons();
    }
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

    setTextIfPresent('currentPubName', pub.name);
    setTextIfPresent('currentPubAddress', pub.address || 'Stockholm');
    setTextIfPresent('currentPubDistance', `📍 ${pub.distanceFromPrevious} m`);
    setTextIfPresent('currentPubTime', `⏱ ${pub.walkingTime} min`);
    setTextIfPresent('currentPubType', `🏷️ ${formatPubType(pub.type)}`);
    setTextIfPresent('currentPubPrice', `💸 ${formatPriceLabel(pub.priceBucket)}`);
    setTextIfPresent('currentPubOpen', `🕒 ${formatOpenLabel(pub.openStatus)}`);
    
    // Update pub type icon
    const icon = getPubTypeIcon(pub.type);
    setTextIfPresent('currentPubTypeIcon', icon);
    
    updateMap();
}

function setTextIfPresent(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = value;
    }
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
                <span class="detail">💸 ${formatPriceLabel(pub.priceBucket)}</span>
                <span class="detail">🕒 ${formatOpenLabel(pub.openStatus)}</span>
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
    // Use exact coordinates when available – far more reliable than a text search
    let destination;
    if (Number.isFinite(pub.lat) && Number.isFinite(pub.lon)) {
        destination = `${pub.lat},${pub.lon}`;
    } else {
        destination = encodeURIComponent(`${pub.name}, ${pub.address || 'Stockholm'}`);
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;
    window.open(url, '_blank');
}

function usePlanB() {
    if (state.currentStopIndex >= state.pubs.length) return;

    const routeIds = new Set(state.pubs.map(p => p.id));
    const currentPub = state.pubs[state.currentStopIndex];
    const prevPoint = state.currentStopIndex === 0
        ? { lat: state.userLocation.lat, lon: state.userLocation.lng }
        : state.pubs[state.currentStopIndex - 1];

    const candidates = state.availablePubs
        .filter(pub => !routeIds.has(pub.id) && pub.id !== currentPub.id)
        .map(pub => ({
            ...pub,
            altDistance: calculateDistance(prevPoint.lat, prevPoint.lon, pub.lat, pub.lon)
        }))
        .sort((a, b) => a.altDistance - b.altDistance)
        .slice(0, 3);

    if (candidates.length === 0) {
        alert('Ingen Plan B hittades inom dina val just nu.');
        return;
    }

    state.planBCandidates = candidates;
    renderPlanBOptions();
    openPlanBModal();
}

function renderPlanBOptions() {
    const container = document.getElementById('planBOptions');
    if (!container) return;

    container.innerHTML = '';
    state.planBCandidates.forEach((pub, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn planb-option-btn';
        btn.innerHTML = `
            <strong>${pub.name}</strong>
            <small>${pub.address || 'Stockholm'}</small>
            <small>📍 ${pub.altDistance} m · 💸 ${formatPriceLabel(pub.priceBucket)} · 🕒 ${formatOpenLabel(pub.openStatus)}</small>
        `;
        btn.addEventListener('click', () => selectPlanB(index));
        container.appendChild(btn);
    });
}

function selectPlanB(index) {
    const replacement = state.planBCandidates[index];
    if (!replacement) return;

    state.pubs[state.currentStopIndex] = { ...replacement };
    recomputeRouteMetrics(state.pubs);
    closePlanBModal();
    displayCurrentPub();
    displayNextPubs();
    saveToLocalStorage();
}

function openPlanBModal() {
    const modal = document.getElementById('planBModal');
    if (modal) modal.classList.add('active');
}

function closePlanBModal() {
    const modal = document.getElementById('planBModal');
    if (modal) modal.classList.remove('active');
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
    state.settings.openNowOnly = true;
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
    const openNowToggle = document.getElementById('openNowToggle');
    if (openNowToggle) {
        openNowToggle.checked = true;
    }

    toggleLocationModeUI();

    if (state.userLocation) {
        updateLocationStatus('success', 'Redo att hoppa!', 'Tryck Min plats eller valj ett eget stalle.');
    } else {
        updateLocationStatus('loading', 'Hämtar din position...', '');
        getUserLocationAuto();
    }
}

function restartToSetup() {
    localStorage.removeItem('pubCrawlState');
    state.availablePubs = [];
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

async function fetchOverpassData(query) {
    const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter'
    ];

    let lastError = null;

    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                body: query
            });

            if (!response.ok) {
                throw new Error(`Overpass ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Overpass unavailable');
}

async function findPubsWithAws(lat, lng) {
    const endpoint = appConfig.awsVenueEndpoint;
    if (!endpoint) return [];

    const url = `${endpoint}?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`AWS venue API error: ${response.status}`);
    }
    const venues = await response.json();
    if (!Array.isArray(venues)) {
        throw new Error('Unexpected response format from AWS venue API');
    }
    return venues
        .filter(v => Number.isFinite(v.lat) && Number.isFinite(v.lon))
        .sort((a, b) => a.distance - b.distance);
}

async function findPubsWithGooglePlaces(lat, lng) {
    const apiKey = appConfig.googlePlacesApiKey;
    if (!apiKey) {
        return [];
    }

    await ensureGooglePlacesLoaded(apiKey);

    if (!window.google?.maps?.places?.PlacesService) {
        return [];
    }

    const service = new google.maps.places.PlacesService(document.createElement('div'));
    const placeTypes = ['bar', 'pub', 'night_club'];
    const allResults = await Promise.all(placeTypes.map((type) => nearbySearch(service, {
        location: new google.maps.LatLng(lat, lng),
        radius: 2000,
        type,
    })));

    return dedupeVenues(
        allResults
            .flat()
            .map((place) => mapGooglePlaceToVenue(place, lat, lng))
            .filter(Boolean)
            .filter(pub => isLikelyPubVenue(pub))
            .sort((a, b) => {
                if (b.confidenceScore !== a.confidenceScore) {
                    return b.confidenceScore - a.confidenceScore;
                }
                return a.distance - b.distance;
            })
    );
}

async function findPubsWithOsm(lat, lng) {
    const radius = 2000;
    const query = `
        [out:json][timeout:25];
        (
            node["amenity"="bar"](around:${radius},${lat},${lng});
            node["amenity"="pub"](around:${radius},${lat},${lng});
            node["amenity"="nightclub"](around:${radius},${lat},${lng});
            way["amenity"="bar"](around:${radius},${lat},${lng});
            way["amenity"="pub"](around:${radius},${lat},${lng});
            way["amenity"="nightclub"](around:${radius},${lat},${lng});
            relation["amenity"="bar"](around:${radius},${lat},${lng});
            relation["amenity"="pub"](around:${radius},${lat},${lng});
            relation["amenity"="nightclub"](around:${radius},${lat},${lng});
        );
        out center tags;
    `;

    const data = await fetchOverpassData(query);

    return dedupeVenues(
        data.elements
            .filter(element => element.tags && element.tags.name)
            .map(element => ({
                id: `${element.type}-${element.id}`,
                name: element.tags.name,
                lat: getElementLatitude(element),
                lon: getElementLongitude(element),
                address: formatAddress(element.tags),
                type: element.tags.amenity,
                openingHours: element.tags.opening_hours,
                website: element.tags.website,
                tags: element.tags,
                priceBucket: estimatePriceBucket(element.tags),
                openStatus: evaluateOpenStatus(element.tags.opening_hours),
                confidenceScore: getVenueConfidenceScore(element.tags),
                distance: calculateDistance(lat, lng, getElementLatitude(element), getElementLongitude(element))
            }))
            .filter(pub => Number.isFinite(pub.lat) && Number.isFinite(pub.lon))
            .filter(pub => isLikelyPubVenue(pub))
            .filter(pub => pub.distance <= 2000)
            .sort((a, b) => {
                if (b.confidenceScore !== a.confidenceScore) {
                    return b.confidenceScore - a.confidenceScore;
                }
                return a.distance - b.distance;
            })
    );
}

function ensureGooglePlacesLoaded(apiKey) {
    if (window.google?.maps?.places) {
        return Promise.resolve();
    }

    if (googlePlacesLoaderPromise) {
        return googlePlacesLoaderPromise;
    }

    googlePlacesLoaderPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Google Places library'));
        document.head.appendChild(script);
    });

    return googlePlacesLoaderPromise;
}

function nearbySearch(service, request) {
    return new Promise((resolve, reject) => {
        service.nearbySearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
                resolve(results || []);
                return;
            }

            if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                resolve([]);
                return;
            }

            reject(new Error(`Google Places status: ${status}`));
        });
    });
}

function mapGooglePlaceToVenue(place, originLat, originLng) {
    const lat = place.geometry?.location?.lat?.();
    const lon = place.geometry?.location?.lng?.();
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
    }

    const types = Array.isArray(place.types) ? place.types : [];
    const type = types.includes('bar')
        ? 'bar'
        : types.includes('pub')
            ? 'pub'
            : types.includes('night_club')
                ? 'nightclub'
                : 'bar';

    const tagLikeData = {
        name: place.name || '',
        website: place.website || '',
        opening_hours: place.opening_hours?.weekday_text?.join('; ') || '',
        'addr:street': place.vicinity || place.formatted_address || '',
        price: mapGooglePriceLevel(place.price_level)
    };

    return {
        id: `google-${place.place_id || normalizeVenueName(place.name)}`,
        name: place.name || 'Okänd bar',
        lat,
        lon,
        address: place.vicinity || place.formatted_address || 'Stockholm',
        type,
        openingHours: tagLikeData.opening_hours,
        website: place.website,
        tags: tagLikeData,
        priceBucket: mapGooglePriceBucket(place.price_level),
        openStatus: mapGoogleOpenStatus(place),
        confidenceScore: getGoogleVenueConfidenceScore(place),
        distance: calculateDistance(originLat, originLng, lat, lon)
    };
}

function mapGooglePriceBucket(priceLevel) {
    if (priceLevel === 0 || priceLevel === 1) return 'low';
    if (priceLevel === 2) return 'medium';
    if (priceLevel === 3 || priceLevel === 4) return 'high';
    return 'unknown';
}

function mapGooglePriceLevel(priceLevel) {
    const priceMap = {
        0: '$',
        1: '$',
        2: '$$',
        3: '$$$',
        4: '$$$$'
    };
    return priceMap[priceLevel] || '';
}

function mapGoogleOpenStatus(place) {
    const openNow = place.opening_hours?.open_now;
    if (typeof openNow === 'boolean') {
        return openNow ? 'open' : 'closed';
    }
    return 'unknown';
}

function getGoogleVenueConfidenceScore(place) {
    let score = 4;

    if (place.business_status === 'OPERATIONAL') score += 2;
    if (place.opening_hours) score += 2;
    if (typeof place.price_level === 'number') score += 1;
    if (place.rating) score += 1;
    if (place.user_ratings_total) score += 1;
    if (place.vicinity || place.formatted_address) score += 1;

    return score;
}

function getElementLatitude(element) {
    return element.lat ?? element.center?.lat;
}

function getElementLongitude(element) {
    return element.lon ?? element.center?.lon;
}

function isLikelyPubVenue(pub) {
    const amenity = (pub.type || '').toLowerCase();
    if (!['bar', 'pub', 'nightclub'].includes(amenity)) {
        return false;
    }

    const haystack = [
        pub.name,
        pub.tags?.brand,
        pub.tags?.operator,
        pub.tags?.description,
        pub.tags?.['addr:street']
    ].filter(Boolean).join(' ').toLowerCase();

    const blockedTerms = [
        'apotek', 'pharmacy', 'sjukhus', 'hospital', 'clinic', 'klinik',
        'vårdcentral', 'vardcentral', 'dentist', 'tand', 'optik', 'optician',
        'skola', 'school', 'gymnasium', 'kontor', 'office', 'bibliotek', 'library'
    ];

    return !blockedTerms.some(term => haystack.includes(term));
}

function getVenueConfidenceScore(tags) {
    let score = 0;

    if (tags.opening_hours) score += 2;
    if (tags.website || tags['contact:website']) score += 2;
    if (tags.phone || tags['contact:phone']) score += 1;
    if (tags['addr:street']) score += 1;
    if (tags['addr:housenumber']) score += 1;
    if (tags.cuisine || tags['drink:beer'] || tags['brewery']) score += 1;

    const name = (tags.name || '').toLowerCase();
    if (name.includes('bar') || name.includes('pub') || name.includes('bistro')) score += 1;

    return score;
}

function dedupeVenues(pubs) {
    const unique = [];

    pubs.forEach((pub) => {
        const normalizedName = normalizeVenueName(pub.name);
        const existingIndex = unique.findIndex((candidate) => {
            if (normalizeVenueName(candidate.name) !== normalizedName) {
                return false;
            }

            return calculateDistance(candidate.lat, candidate.lon, pub.lat, pub.lon) < 40;
        });

        if (existingIndex === -1) {
            unique.push(pub);
            return;
        }

        const existing = unique[existingIndex];
        if (pub.confidenceScore > existing.confidenceScore) {
            unique[existingIndex] = pub;
        }
    });

    return unique;
}

function normalizeVenueName(name) {
    return (name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function recomputeRouteMetrics(routePubs) {
    routePubs.forEach((pub, index) => {
        if (index === 0) {
            pub.distanceFromPrevious = calculateDistance(
                state.userLocation.lat,
                state.userLocation.lng,
                pub.lat,
                pub.lon
            );
        } else {
            pub.distanceFromPrevious = calculateDistance(
                routePubs[index - 1].lat,
                routePubs[index - 1].lon,
                pub.lat,
                pub.lon
            );
        }
        pub.walkingTime = Math.ceil(pub.distanceFromPrevious / 80);
    });
}

function estimatePriceBucket(tags) {
    const rawPrice = (tags.price || tags['drink:price'] || '').toString().trim();
    if (rawPrice) {
        const symbolCount = (rawPrice.match(/[\$€£]/g) || []).length;
        if (symbolCount >= 3) return 'high';
        if (symbolCount === 2) return 'medium';
        if (symbolCount === 1) return 'low';

        const numeric = parseFloat(rawPrice.replace(',', '.').replace(/[^0-9.]/g, ''));
        if (!Number.isNaN(numeric)) {
            if (numeric <= 60) return 'low';
            if (numeric <= 120) return 'medium';
            return 'high';
        }
    }

    const charge = parseFloat((tags.charge || '').toString().replace(',', '.').replace(/[^0-9.]/g, ''));
    if (!Number.isNaN(charge)) {
        if (charge <= 60) return 'low';
        if (charge <= 120) return 'medium';
        return 'high';
    }

    return 'unknown';
}

function filterPubsByPrice(pubs, priceLevel) {
    const scored = pubs.map(pub => ({
        ...pub,
        priceScore: getPriceScore(pub.priceBucket, priceLevel),
    }));

    scored.sort((a, b) => {
        if (a.priceScore !== b.priceScore) return a.priceScore - b.priceScore;
        return a.distance - b.distance;
    });

    if (priceLevel === 'all') {
        return scored;
    }

    // Keep primarily relevant price buckets but include unknowns as fallback.
    const top = scored.filter(pub => pub.priceScore <= 1);
    return top.length >= 8 ? top : scored;
}

function getPriceScore(bucket, level) {
    const map = { low: 0, medium: 1, high: 2, unknown: 1 };
    const target = level === 'budget' ? 0 : level === 'medium' ? 1 : 1;
    return Math.abs((map[bucket] ?? 1) - target);
}

function evaluateOpenStatus(openingHours) {
    if (!openingHours || typeof openingHours !== 'string') return 'unknown';

    const value = openingHours.trim();
    if (!value) return 'unknown';
    if (value.includes('24/7')) return 'open';

    const dayKeys = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
    const currentDay = dayKeys[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const rules = value.split(';').map(r => r.trim()).filter(Boolean);
    let hadDayRule = false;

    for (const rule of rules) {
        const hasDayToken = dayKeys.some(day => rule.includes(day));
        let dayMatches = !hasDayToken;

        if (hasDayToken) {
            hadDayRule = true;
            dayMatches = dayRuleMatches(rule, currentDay);
        }

        if (!dayMatches) continue;

        if (/\boff\b/i.test(rule)) {
            return 'closed';
        }

        const timeRanges = rule.match(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/g);
        if (!timeRanges || timeRanges.length === 0) {
            return hasDayToken ? 'open' : 'unknown';
        }

        const isOpenNow = timeRanges.some((range) => {
            const [startRaw, endRaw] = range.split('-').map(v => v.trim());
            const start = toMinutes(startRaw);
            const end = toMinutes(endRaw);
            if (start <= end) {
                return nowMinutes >= start && nowMinutes <= end;
            }
            return nowMinutes >= start || nowMinutes <= end;
        });

        if (isOpenNow) return 'open';
    }

    return hadDayRule ? 'closed' : 'unknown';
}

function dayRuleMatches(rule, currentDay) {
    const dayParts = rule.match(/(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?/g) || [];
    if (dayParts.length === 0) return false;

    const dayOrder = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
    const currentIndex = dayOrder.indexOf(currentDay);

    return dayParts.some((part) => {
        const [start, end] = part.split('-');
        const startIndex = dayOrder.indexOf(start);
        if (!end) return startIndex === currentIndex;

        const endIndex = dayOrder.indexOf(end);
        if (startIndex <= endIndex) {
            return currentIndex >= startIndex && currentIndex <= endIndex;
        }
        return currentIndex >= startIndex || currentIndex <= endIndex;
    });
}

function toMinutes(time) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

function formatPriceLabel(bucket) {
    const labels = {
        low: 'Låg',
        medium: 'Mellan',
        high: 'Hög',
        unknown: 'Okänd',
    };
    return labels[bucket] || 'Okänd';
}

function formatOpenLabel(status) {
    const labels = {
        open: 'Öppet nu',
        closed: 'Stängt nu',
        unknown: 'Okänd status',
    };
    return labels[status] || 'Okänd status';
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
        availablePubs: state.availablePubs,
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

        if (data.settings && typeof data.settings.openNowOnly !== 'boolean') {
            data.settings.openNowOnly = true;
        }
        
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

