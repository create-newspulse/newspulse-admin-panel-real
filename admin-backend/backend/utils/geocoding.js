// backend/utils/geocoding.js
const axios = require('axios');

/**
 * Fetch latitude and longitude coordinates for a given address using Google Maps Geocoding API.
 * @param {string} address - The address to geocode.
 * @returns {Promise<{lat: number, lng: number} | null>} Coordinates or null if failed.
 */
const getCoordinates = async (address) => {
  if (!address) {
    console.warn('⚠️ No address provided to geocoder.');
    return null;
  }

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address,
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    const { status, results } = response.data;

    if (status !== 'OK' || !results || results.length === 0) {
      console.warn(`⚠️ Geocoding API returned status: ${status}`);
      return null;
    }

    const { lat, lng } = results[0].geometry.location;
    return { lat, lng };
  } catch (error) {
    console.error('❌ Geocoding API Error:', error.message);
    return null;
  }
};

module.exports = { getCoordinates };
