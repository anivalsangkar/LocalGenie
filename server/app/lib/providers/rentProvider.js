// Author: Your Name | Role: BE2 | Feature: rentProvider
// Uses Realtor API to fetch average rent by city/state.
// Returns { avgMonthly }. On error, returns { avgMonthly: null }.
// Data source: Realtor API (see docs for endpoint details).

const axios = require('axios');

async function getRent({ city, state }) {
  const apiKey = process.env.REALTOR_API_KEY;
  if (!apiKey) return { avgMonthly: null };
  try {
    const url = `https://realtor.p.rapidapi.com/properties/v2/list-for-rent?city=${encodeURIComponent(city)}&state_code=${encodeURIComponent(state)}&limit=20`;
    const headers = {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': 'realtor.p.rapidapi.com',
    };
    const { data } = await axios.get(url, { headers, timeout: 5000 });
    if (!data || !data.properties || !Array.isArray(data.properties) || data.properties.length === 0) {
      return { avgMonthly: null };
    }
    const rents = data.properties.map(p => Number(p.price)).filter(r => !isNaN(r));
    const avgMonthly = rents.length ? (rents.reduce((a, b) => a + b, 0) / rents.length) : null;
    return { avgMonthly };
  } catch (e) {
    return { avgMonthly: null };
  }
}

module.exports = { getRent };
