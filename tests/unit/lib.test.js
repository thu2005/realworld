const lib = require('../../lib');
const config = require('../../front/config');

describe('Unit Tests: Helpers & Utilities (lib.js)', () => {
  describe('validatePositiveInteger', () => {
    test('1. should return true and parsed integer for positive integer number', () => {
      const [val, ok] = lib.validatePositiveInteger(42);
      expect(ok).toBe(true);
      expect(val).toBe(42);
    });

    test('2. should return true and parsed integer for numeric string', () => {
      const [val, ok] = lib.validatePositiveInteger('100');
      expect(ok).toBe(true);
      expect(val).toBe(100);
    });

    test('3. should return true for zero (0)', () => {
      const [val, ok] = lib.validatePositiveInteger(0);
      expect(ok).toBe(true);
      expect(val).toBe(0);
    });

    test('4. should return false for negative numbers', () => {
      const [val, ok] = lib.validatePositiveInteger(-5);
      expect(ok).toBe(false);
      expect(val).toBe(-5);
    });

    test('5. should return false for floating point numbers', () => {
      const [val, ok] = lib.validatePositiveInteger(3.14);
      expect(ok).toBe(false);
      expect(val).toBe(3.14);
    });

    test('6. should return false for empty string', () => {
      const [, ok] = lib.validatePositiveInteger('');
      expect(ok).toBe(false);
    });

    test('7. should return false for non-numeric strings', () => {
      const [, ok] = lib.validatePositiveInteger('abc');
      expect(ok).toBe(false);
    });
  });

  describe('validateParam', () => {
    test('8. should return defaultValue if parameter is undefined in object', () => {
      const res = lib.validateParam({}, 'limit', lib.validatePositiveInteger, 20);
      expect(res).toBe(20);
    });

    test('9. should return validated value if parameter is valid', () => {
      const res = lib.validateParam({ limit: '15' }, 'limit', lib.validatePositiveInteger, 20);
      expect(res).toBe(15);
    });

    test('10. should throw ValidationError with 422 if parameter validation fails', () => {
      expect(() => {
        lib.validateParam({ limit: 'invalid' }, 'limit', lib.validatePositiveInteger, 20);
      }).toThrow(lib.ValidationError);

      try {
        lib.validateParam({ limit: 'invalid' }, 'limit', lib.validatePositiveInteger, 20);
      } catch (err) {
        expect(err.status).toBe(422);
        expect(err.errors).toHaveProperty('limit');
      }
    });
  });

  describe('ValidationError', () => {
    test('11. should instantiate properly with errors object and status code', () => {
      const err = new lib.ValidationError({ email: ['is invalid'] }, 422);
      expect(err).toBeInstanceOf(Error);
      expect(err.status).toBe(422);
      expect(err.errors).toEqual({ email: ['is invalid'] });
    });
  });

  describe('getClientIp', () => {
    test('12. should extract IP from x-forwarded-for header', () => {
      const mockReq = {
        header: jest.fn().mockReturnValue('192.168.1.1, 10.0.0.1')
      };
      const ip = lib.getClientIp(mockReq);
      expect(mockReq.header).toHaveBeenCalledWith('x-forwarded-for');
      expect(ip).toBe('192.168.1.1, 10.0.0.1');
    });

    test('13. should return undefined when header is not present', () => {
      const mockReq = {
        header: jest.fn().mockReturnValue(undefined)
      };
      const ip = lib.getClientIp(mockReq);
      expect(ip).toBeUndefined();
    });
  });

  describe('getIndexTags', () => {
    test('14. should extract tag names array from Tag model query', async () => {
      const mockSequelize = {
        models: {
          Tag: {
            findAll: jest.fn().mockResolvedValue([
              { name: 'angular' },
              { name: 'react' },
              { name: 'testing' }
            ])
          }
        }
      };

      const tags = await lib.getIndexTags(mockSequelize);
      expect(tags).toEqual(['angular', 'react', 'testing']);
    });
  });

  describe('deleteOldestForDemo', () => {
    test('15. should delete oldest rows when demo mode is active and excess rows exist', async () => {
      const originalIsDemo = config.isDemo;
      config.isDemo = true;

      const mockModel = {
        findAll: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
        destroy: jest.fn().mockResolvedValue(2)
      };

      await lib.deleteOldestForDemo(mockModel);
      expect(mockModel.findAll).toHaveBeenCalled();
      expect(mockModel.destroy).toHaveBeenCalled();

      config.isDemo = originalIsDemo;
    });

    test('16. should not delete if no old rows are returned in demo mode', async () => {
      const originalIsDemo = config.isDemo;
      config.isDemo = true;

      const mockModel = {
        findAll: jest.fn().mockResolvedValue([]),
        destroy: jest.fn()
      };

      await lib.deleteOldestForDemo(mockModel);
      expect(mockModel.destroy).not.toHaveBeenCalled();

      config.isDemo = originalIsDemo;
    });
  });
});
