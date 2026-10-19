jest.mock(
  'jsonwebtoken',
  () => ({
    sign: jest.fn().mockReturnValue('sample.jwt.token')
  }),
  { virtual: true }
);

jest.mock(
  'sequelize',
  () => ({
    DataTypes: {
      STRING: jest.fn().mockReturnValue('STRING'),
      INTEGER: jest.fn().mockReturnValue('INTEGER')
    },
    Op: { col: 'col' },
    Sequelize: { fn: jest.fn(), col: jest.fn() }
  }),
  { virtual: true }
);

jest.mock(
  'slug',
  () => jest.fn((str) => String(str).toLowerCase().replace(/\s+/g, '-')),
  { virtual: true }
);

const userFactory = require('../../models/user');
const articleFactory = require('../../models/article');

describe('Unit Tests: Domain Models (User & Article)', () => {
  let User;
  let Article;

  beforeAll(() => {
    const mockSequelize = {
      define: (name, schema, options) => {
        function Model(attrs = {}) {
          Object.assign(this, attrs);
        }
        Model.prototype = {
          setDataValue(key, val) {
            this[key] = val;
          }
        };
        Model.schema = schema;
        Model.options = options;
        return Model;
      }
    };

    User = userFactory(mockSequelize);
    Article = articleFactory(mockSequelize);
  });

  describe('User Model Password Hashing & Verification', () => {
    test('1. User.setPassword should generate salt and PBKDF2 hash', () => {
      const user = {};
      User.setPassword(user, 'superSecret123');

      expect(user.salt).toBeDefined();
      expect(typeof user.salt).toBe('string');
      expect(user.hash).toBeDefined();
      expect(user.hash.length).toBeGreaterThan(32);
    });

    test('2. User.validPassword should return true for correct password', () => {
      const user = {};
      User.setPassword(user, 'myPassword123');

      const isValid = User.validPassword(user, 'myPassword123');
      expect(isValid).toBe(true);
    });

    test('3. User.validPassword should return false for incorrect password', () => {
      const user = {};
      User.setPassword(user, 'correctPassword');

      const isValid = User.validPassword(user, 'wrongPassword');
      expect(isValid).toBe(false);
    });
  });

  describe('User Model Token & Serialization', () => {
    test('4. User.prototype.generateJWT should create a valid signed JWT', () => {
      const userInstance = new User({
        id: 101,
        username: 'johndoe',
        email: 'john@example.com'
      });

      const token = userInstance.generateJWT();
      expect(typeof token).toBe('string');
      expect(token).toBe('sample.jwt.token');
    });

    test('5. User.prototype.toAuthJSON should format authentication response object', () => {
      const userInstance = new User({
        id: 102,
        username: 'janedoe',
        email: 'jane@example.com',
        bio: 'Software Tester',
        image: 'https://avatar.png'
      });

      const authJSON = userInstance.toAuthJSON();
      expect(authJSON.username).toBe('janedoe');
      expect(authJSON.email).toBe('jane@example.com');
      expect(authJSON.bio).toBe('Software Tester');
      expect(authJSON.image).toBe('https://avatar.png');
      expect(authJSON.token).toBe('sample.jwt.token');
    });

    test('6. User schema setters should normalize email and username to lowercase', () => {
      const userInstance = new User({});
      User.schema.username.set.call(userInstance, 'JohnDoe');
      User.schema.email.set.call(userInstance, 'Test@Example.COM');

      expect(userInstance.username).toBe('johndoe');
      expect(userInstance.email).toBe('test@example.com');
    });

    test('7. User schema validation rules should enforce username regex pattern', () => {
      const regex = User.schema.username.validate.is.args;
      expect(regex.test('valid-user_123')).toBe(true);
      expect(regex.test('123invalid')).toBe(false);
      expect(regex.test('user name')).toBe(false);
    });
  });

  describe('Article Model Hooks & Slug Generation', () => {
    test('8. Article hook should auto-generate lowercase slug from title if not set', () => {
      const articleInstance = new Article({
        title: 'CI/CD Automation with Jest and SuperTest',
        description: 'Testing guide',
        body: 'Body content'
      });

      Article.options.hooks.beforeValidate(articleInstance);

      expect(articleInstance.slug).toBeDefined();
      expect(articleInstance.slug.startsWith('ci/cd-automation-with-jest-and-supertest')).toBe(true);
    });

    test('9. Article hook should preserve existing slug if already present', () => {
      const articleInstance = new Article({
        title: 'My Custom Slug Article',
        slug: 'custom-slug-123'
      });

      Article.options.hooks.beforeValidate(articleInstance);
      expect(articleInstance.slug).toBe('custom-slug-123');
    });
  });
});
