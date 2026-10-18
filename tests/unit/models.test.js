const models = require('../../models');

describe('Unit Tests: Domain Models (User, Article, Tag)', () => {
  let sequelize;
  let User;
  let Article;

  beforeAll(async () => {
    sequelize = models.getSequelize();
    User = sequelize.models.User;
    Article = sequelize.models.Article;
  });

  afterAll(async () => {
    if (sequelize) {
      await sequelize.close();
    }
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
      const userInstance = User.build({
        id: 101,
        username: 'johndoe',
        email: 'john@example.com'
      });

      const token = userInstance.generateJWT();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });

    test('5. User.prototype.toAuthJSON should format authentication response object', () => {
      const userInstance = User.build({
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
      expect(authJSON.token).toBeDefined();
    });

    test('6. User.prototype.toProfileJSONFor should provide default image if none specified', async () => {
      const userInstance = User.build({
        username: 'alex',
        bio: 'Developer'
      });

      const profileJSON = await userInstance.toProfileJSONFor(null);
      expect(profileJSON.username).toBe('alex');
      expect(profileJSON.bio).toBe('Developer');
      expect(profileJSON.image).toContain('productionready.io');
      expect(profileJSON.following).toBe(false);
    });
  });

  describe('Article Model Hooks & Validation', () => {
    test('7. Article hook should auto-generate lowercase slug from title if not set', () => {
      const articleInstance = Article.build({
        title: 'CI/CD Automation with Jest and SuperTest',
        description: 'Testing guide',
        body: 'Body content'
      });

      // Trigger beforeValidate hook
      Article.options.hooks.beforeValidate(articleInstance);

      expect(articleInstance.slug).toBeDefined();
      expect(articleInstance.slug.startsWith('ci-cd-automation-with-jest-and-supertest')).toBe(true);
    });
  });
});
