// Author: Your Name | Role: BE2 | Feature: rentProvider test
process.env.REALTOR_API_KEY = 'dummy';
const { getRent } = require('../lib/providers/rentProvider');
const axios = require('axios');
jest.mock('axios');

describe('getRent', () => {
  it('returns avgMonthly for valid response', async () => {
    axios.get.mockResolvedValue({
      data: {
        properties: [
          { price: '2000' },
          { price: '2500' },
          { price: '1800' },
        ],
      },
    });
    const result = await getRent({ city: 'Austin', state: 'TX' });
    expect(result).toEqual({ avgMonthly: 2100 });
  });

  it('returns null on API error', async () => {
    axios.get.mockRejectedValue(new Error('fail'));
    const result = await getRent({ city: 'Austin', state: 'TX' });
    expect(result).toEqual({ avgMonthly: null });
  });

  it('returns null if no properties', async () => {
    axios.get.mockResolvedValue({ data: { properties: [] } });
    const result = await getRent({ city: 'Austin', state: 'TX' });
    expect(result).toEqual({ avgMonthly: null });
  });
});
