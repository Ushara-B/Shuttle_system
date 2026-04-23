/**
 * Haversine formula — calculate the distance (in km) between two GPS coordinates.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in km rounded to 2 decimals
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const toRad = (v) => (v * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c * 100) / 100; // Round to 2 decimal places
}

// Campus coordinates
const CAMPUS_COORDS = { lat: 6.9036, lng: 79.9547 };

module.exports = { haversineDistance, CAMPUS_COORDS };
