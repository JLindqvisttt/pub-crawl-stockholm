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

function saveGroupToLocalStorage() {
    if (!state.groupCode) return;

    const groupData = {
        pubs: state.pubs,
        members: state.groupMembers,
        createdAt: Date.now()
    };

    localStorage.setItem(`group_${state.groupCode}`, JSON.stringify(groupData));
}
