import * as Location from 'expo-location';

// University campus coordinates
export const CAMPUS_COORDS = { latitude: 6.9036, longitude: 79.9547 };

/**
 * Request location permission and get current GPS coordinates.
 */
export async function getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
    // We request foreground-only permission because the app only needs location
    // while the user is actively using it (wallet screen to estimate fare / save home location).
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            console.warn('Location permission denied');
            return null;
        }

        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
        });

        return {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
        };
    } catch (error) {
        console.error('Error getting location:', error);
        return null;
    }
}

/**
 * Haversine formula — calculate distance between two GPS coordinates in km.
 */
export function calculateDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
): number {
    // Deterministic distance helper used by UI only.
    // The backend is the source of truth for charging; this is a user-facing estimate.
    const R = 6371; // Earth radius in km
    const toRad = (v: number) => (v * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c * 100) / 100;
}

/**
 * Calculate fare based on distance and price per km.
 */
export function calculateFare(distanceKm: number, pricePerKm: number): number {
    // Used for local display only (estimate).
    return Math.round(distanceKm * pricePerKm);
}

/**
 * Get distance from current location to campus.
 */
export function getDistanceToCampus(latitude: number, longitude: number): number {
    // Convenience helper for wallet screen.
    return calculateDistance(latitude, longitude, CAMPUS_COORDS.latitude, CAMPUS_COORDS.longitude);
}
