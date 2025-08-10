// server/app/lib/location.js
// Minimal city/state parser for prompts like:
//  - "summary of Austin, TX"
//  - "tell me about Seattle WA"
//  - "about Miami, Florida" (accepts full state names too)

const US_STATES = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
    CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
    HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
    KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
    MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
    MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
    NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
    ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
    RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
    TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
    WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia'
};

const STATE_NAMES = Object.values(US_STATES).reduce((acc, name) => {
    acc[name.toLowerCase()] = name;
    return acc;
}, {});

function normalizeState(input) {
    if (!input) return null;
    const up = input.trim().toUpperCase();
    if (US_STATES[up]) return up;

    const lower = input.trim().toLowerCase();
    if (STATE_NAMES[lower]) {
        // map full name -> abbrev
        const abbr = Object.entries(US_STATES).find(([, n]) => n.toLowerCase() === lower)?.[0];
        return abbr || null;
    }
    return null;
}

function parseCityState(prompt = '') {
    const p = String(prompt).trim();

    // patterns we accept
    // 1) "summary of Austin, TX" / "tell me about Austin TX"
    const re1 = /\b(?:summary of|tell me about|about|info on|information on)\s+([a-z .'-]+?)[,\s]+([a-z .'-]+)\b/i;

    // 2) "what can you tell me about Austin, Texas"
    const re2 = /\b([a-z .'-]+?),\s*([a-z .'-]+)\b/i;

    // Try re1 first (more specific)
    let m = p.match(re1);
    if (!m) m = p.match(re2);

    if (m) {
        const rawCity = m[1].trim().replace(/\s+/g, ' ');
        const rawState = m[2].trim().replace(/\s+/g, ' ');
        const state = normalizeState(rawState);
        if (state && rawCity) {
            const city = rawCity.split(' ').map(s => s[0] ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s).join(' ');
            return { city, state };
        }
    }

    // Also accept "Austin TX" without comma if obvious
    const reLoose = /\b([a-z .'-]+)\s+([A-Za-z]{2})\b/;
    const m2 = p.match(reLoose);
    if (m2) {
        const rawCity = m2[1].trim();
        const state = normalizeState(m2[2]);
        if (state && rawCity) {
            const city = rawCity.split(' ').map(s => s[0] ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s).join(' ');
            return { city, state };
        }
    }

    return null;
}

module.exports = { parseCityState, normalizeState, US_STATES };