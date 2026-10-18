const request = require('supertest');
const app = require('../../app');
const test_lib = require('../../test_lib');

describe('Integration Tests: RealWorld REST API (SuperTest)', () => {
  let serverInstance;
  let sequelize;
  let token;
  let createdSlug;

  beforeAll((done) => {
    app.start(0, false, (server) => {
      serverInstance = server;
      sequelize = server.app ? server.app.get('sequelize') : null;
      done();
    });
  });

  afterAll((done) => {
    if (serverInstance) {
      serverInstance.close(() => done());
    } else {
      done();
    }
  });

  beforeEach(async () => {
    if (sequelize) {
      await test_lib.generateDemoData({ sequelize, empty: true });
    }
  });

  const validUser = {
    user: {
      username: 'tester_one',
      email: 'tester_one@example.com',
      password: 'password123'
    }
  };

  describe('1. Authentication Endpoints', () => {
    test('POST /api/users - Should register a new user successfully (200)', async () => {
      const res = await request(serverInstance)
        .post('/api/users')
        .send(validUser);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(validUser.user.email);
      expect(res.body.user.username).toBe(validUser.user.username);
      expect(res.body.user.token).toBeDefined();
      token = res.body.user.token;
    });

    test('POST /api/users - Should return 422 for invalid email or missing fields', async () => {
      const res = await request(serverInstance)
        .post('/api/users')
        .send({
          user: {
            username: 'bad',
            email: 'invalid-email',
            password: '123'
          }
        });

      expect(res.status).toBe(422);
      expect(res.body.errors).toBeDefined();
    });

    test('POST /api/users/login - Should login successfully with valid credentials (200)', async () => {
      await request(serverInstance).post('/api/users').send(validUser);

      const res = await request(serverInstance)
        .post('/api/users/login')
        .send({
          user: {
            email: validUser.user.email,
            password: validUser.user.password
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.user.token).toBeDefined();
      token = res.body.user.token;
    });

    test('POST /api/users/login - Should return 422 for incorrect password', async () => {
      await request(serverInstance).post('/api/users').send(validUser);

      const res = await request(serverInstance)
        .post('/api/users/login')
        .send({
          user: {
            email: validUser.user.email,
            password: 'wrong_password'
          }
        });

      expect(res.status).toBe(422);
    });

    test('GET /api/user - Should return current user when authenticated (200)', async () => {
      const reg = await request(serverInstance).post('/api/users').send(validUser);
      const userToken = reg.body.user.token;

      const res = await request(serverInstance)
        .get('/api/user')
        .set('Authorization', `Token ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe(validUser.user.username);
    });

    test('GET /api/user - Should return 401 without authorization header', async () => {
      const res = await request(serverInstance).get('/api/user');
      expect(res.status).toBe(401);
    });
  });

  describe('2. Articles CRUD Endpoints', () => {
    beforeEach(async () => {
      const reg = await request(serverInstance).post('/api/users').send(validUser);
      token = reg.body.user.token;
    });

    test('POST /api/articles - Should create article with valid token (200)', async () => {
      const res = await request(serverInstance)
        .post('/api/articles')
        .set('Authorization', `Token ${token}`)
        .send({
          article: {
            title: 'How to Train Your Dragon with CI/CD',
            description: 'Ever wonder how dragons fly in automated pipelines?',
            body: 'It takes a lot of automated testing and proper test harness setup.',
            tagList: ['dragons', 'training', 'testing']
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.article).toBeDefined();
      expect(res.body.article.title).toBe('How to Train Your Dragon with CI/CD');
      expect(res.body.article.slug).toBeDefined();
      createdSlug = res.body.article.slug;
    });

    test('POST /api/articles - Should return 401 when creating article without auth', async () => {
      const res = await request(serverInstance)
        .post('/api/articles')
        .send({
          article: {
            title: 'Unauthenticated Article',
            description: 'No token',
            body: 'Should fail'
          }
        });

      expect(res.status).toBe(401);
    });

    test('GET /api/articles - Should list articles with pagination (200)', async () => {
      const res = await request(serverInstance).get('/api/articles?limit=10&offset=0');
      expect(res.status).toBe(200);
      expect(res.body.articles).toBeDefined();
      expect(Array.isArray(res.body.articles)).toBe(true);
    });

    test('GET /api/articles/:slug - Should get article by slug (200)', async () => {
      const createRes = await request(serverInstance)
        .post('/api/articles')
        .set('Authorization', `Token ${token}`)
        .send({
          article: {
            title: 'Unique Fetch Article',
            description: 'Testing fetch',
            body: 'Body fetch'
          }
        });
      const slug = createRes.body.article.slug;

      const res = await request(serverInstance).get(`/api/articles/${slug}`);
      expect(res.status).toBe(200);
      expect(res.body.article.title).toBe('Unique Fetch Article');
    });

    test('GET /api/articles/:slug - Should return 404 for non-existent slug', async () => {
      const res = await request(serverInstance).get('/api/articles/non-existent-article-slug-xyz');
      expect(res.status).toBe(404);
    });
  });

  describe('3. Tags & Profiles Endpoints', () => {
    test('GET /api/tags - Should return list of tags (200)', async () => {
      const res = await request(serverInstance).get('/api/tags');
      expect(res.status).toBe(200);
      expect(res.body.tags).toBeDefined();
      expect(Array.isArray(res.body.tags)).toBe(true);
    });

    test('GET /api/profiles/:username - Should fetch user profile (200)', async () => {
      await request(serverInstance).post('/api/users').send(validUser);

      const res = await request(serverInstance).get(`/api/profiles/${validUser.user.username}`);
      expect(res.status).toBe(200);
      expect(res.body.profile.username).toBe(validUser.user.username);
    });
  });
});
