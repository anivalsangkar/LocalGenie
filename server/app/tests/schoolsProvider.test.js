// Author: Your Name | Role: BE2 | Feature: schoolsProvider test
process.env.SCHOOLDIGGER_API_APPID = 'dummy';
process.env.SCHOOLDIGGER_API_APPKEY = 'dummy';
const { getSchools } = require('../lib/providers/schoolsProvider');
const axios = require('axios');
jest.mock('axios');

describe('getSchools', () => {
  it('returns avgRating and count for valid response', async () => {
    axios.get.mockResolvedValue({
      data: {
        schoolList: [
          { overallRating: '8.5' },
          { overallRating: '7.0' },
          { overallRating: '9.0' },
        ],
      },
    });
    const result = await getSchools({ lat: 1, lng: 2 });
    expect(result).toEqual({ avgRating: 8.166666666666666, count: 3 });
  });

  it('returns null and 0 on API error', async () => {
    axios.get.mockRejectedValue(new Error('fail'));
    const result = await getSchools({ lat: 1, lng: 2 });
    expect(result).toEqual({ avgRating: null, count: 0 });
  });

  it('returns null and 0 if no schools', async () => {
    axios.get.mockResolvedValue({ data: { schoolList: [] } });
    const result = await getSchools({ lat: 1, lng: 2 });
    expect(result).toEqual({ avgRating: null, count: 0 });
  });
});
