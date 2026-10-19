jest.mock(
  'express-jwt',
  () => {
    return jest.fn((options) => {
      const middleware = (req, res, next) => {
        const token = options.getToken ? options.getToken(req) : null;
        if (!token && options.credentialsRequired !== false) {
          const err = new Error('No authorization token was found');
          err.name = 'UnauthorizedError';
          return next(err);
        }
        req.user = { token };
        next();
      };
      middleware.options = options;
      return middleware;
    });
  },
  { virtual: true }
);

const auth = require('../../auth');

describe('Unit Tests: Authentication Middleware & Helpers (auth.js)', () => {
  test('1. auth.required should be configured with credentialsRequired true', () => {
    expect(typeof auth.required).toBe('function');
    expect(auth.required.options.credentialsRequired).not.toBe(false);
  });

  test('2. auth.optional should be configured with credentialsRequired false', () => {
    expect(typeof auth.optional).toBe('function');
    expect(auth.optional.options.credentialsRequired).toBe(false);
  });

  test('3. auth.required should reject requests with missing token', (done) => {
    const req = { headers: {} };
    auth.required(req, {}, (err) => {
      expect(err).toBeDefined();
      expect(err.name).toBe('UnauthorizedError');
      done();
    });
  });

  test('4. auth.required should extract valid Token prefix from authorization header', (done) => {
    const req = { headers: { authorization: 'Token sample.jwt.token' } };
    auth.required(req, {}, (err) => {
      expect(err).toBeUndefined();
      expect(req.user.token).toBe('sample.jwt.token');
      done();
    });
  });

  test('5. auth.required should extract valid Bearer prefix from authorization header', (done) => {
    const req = { headers: { authorization: 'Bearer sample.bearer.token' } };
    auth.required(req, {}, (err) => {
      expect(err).toBeUndefined();
      expect(req.user.token).toBe('sample.bearer.token');
      done();
    });
  });

  test('6. auth.optional should pass without error when authorization header is absent', (done) => {
    const req = { headers: {} };
    auth.optional(req, {}, (err) => {
      expect(err).toBeUndefined();
      done();
    });
  });
});
