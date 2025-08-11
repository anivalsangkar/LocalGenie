// Author: Your Name | Role: BE2 | Feature: schoolsProvider
// Uses SchoolDigger API to fetch schools by lat/lng and returns average rating and count.
// Scoring: avgRating is the mean of all school ratings (0-10), count is the number of schools found.
// Returns { avgRating: 0-10, count }. On error, returns { avgRating: null, count: 0 }.

const axios = require('axios');

async function getSchools({ lat, lng }) {
  const appId = process.env.SCHOOLDIGGER_API_APPID;
  const appKey = process.env.SCHOOLDIGGER_API_APPKEY;
  if (!appId || !appKey) return { avgRating: null, count: 0 };
  try {
    const url = `https://api.schooldigger.com/v1.2/schools?st=&lat=${lat}&lon=${lng}&distance=5&appID=${appId}&appKey=${appKey}`;
    const { data } = await axios.get(url, { timeout: 5000 });
    if (!data || !data.schoolList || !Array.isArray(data.schoolList) || data.schoolList.length === 0) {
      return { avgRating: null, count: 0 };
    }
    const ratings = data.schoolList.map(s => Number(s.overallRating)).filter(r => !isNaN(r));
    const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : null;
    return { avgRating, count: data.schoolList.length };
  } catch (e) {
    return { avgRating: null, count: 0 };
  }
}

module.exports = { getSchools };
