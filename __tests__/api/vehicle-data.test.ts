import { createMocks } from 'node-mocks-http';
import handler from '../../pages/api/vehicle-data';

jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null }),
    upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

describe('/api/vehicle-data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ make: 'Volvo', model: 'XC60', year: 2020 }),
    });
  });

  it('returns 405 for non-GET requests', async () => {
    const { req, res } = createMocks({
      method: 'POST',
    });

    await handler(req, res);

    expect(res.statusCode).toBe(405);
  });

  it('returns 400 if registration number is missing', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: {},
    });

    await handler(req, res);

    expect(res.statusCode).toBe(400);
  });

  it('returns vehicle data for valid registration number', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { reg: 'ABC123' },
    });

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({
        make: 'Volvo',
        model: 'XC60',
      })
    );
  });
}); 