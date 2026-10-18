const auth = require('../../auth');

describe('Unit Tests: Authentication Middleware & Helpers (auth.js)', () => {
  test('1. auth.required should be defined as middleware function', () => {
    expect(typeof auth.required).toBe('function');
  });

  test('2. auth.optional should be defined as middleware function', () => {
    expect(typeof auth.optional).toBe('function');
  });

  test('3. auth.required middleware rejects request without authorization header', (done) => {
    const req = { headers: {} };
    const res = {};
    const next = (err) => {
      expect(err).toBeDefined();
      expect(err.name).toBe('UnauthorizedError');
      done();
    };

    auth.required(req, res, next);
  });

  test('4. auth.optional middleware proceeds without error when authorization header is absent', (done) => {
    const req = { headers: {} };
    const res = {};
    const next = (err) => {
      expect(err).toBeUndefined();
      done();
    };

    auth.optional(req, res, next);
  });
});
