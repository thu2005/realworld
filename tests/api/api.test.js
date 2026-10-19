const supertest = require('supertest');

const API_BASE = process.env.API_URL || 'http://localhost:3000';
const request = supertest(API_BASE);

describe('Integration Tests: RealWorld REST API (SuperTest)', () => {
  const randomSuffix = Math.floor(Math.random() * 100000);
  const testUser = {
    user: {
      username: `testuser_${randomSuffix}`,
      email: `testuser_${randomSuffix}@example.com`,
      password: 'password123'
    }
  };

  let token = null;
  let createdSlug = null;

  describe('1. Health & Tags Endpoints', () => {
    test('GET /api/tags - Should return 200 with tags array', async () => {
      const res = await request.get('/api/tags');
      expect([200, 304]).toContain(res.status);
      expect(res.body).toHaveProperty('tags');
      expect(Array.isArray(res.body.tags)).toBe(true);
    });
  });

  describe('2. User Authentication Endpoints', () => {
    test('POST /api/users - Should register a new user successfully (200)', async () => {
      const res = await request
        .post('/api/users')
        .send(testUser);

      expect([200, 201]).toContain(res.status);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testUser.user.email.toLowerCase());
      expect(res.body.user.username).toBe(testUser.user.username.toLowerCase());
      expect(res.body.user.token).toBeDefined();
      token = res.body.user.token;
    });

    test('POST /api/users - Should reject duplicate email or username with 422', async () => {
      const res = await request
        .post('/api/users')
        .send(testUser);

      expect(res.status).toBe(422);
      expect(res.body.errors).toBeDefined();
    });

    test('POST /api/users/login - Should login successfully with valid credentials (200)', async () => {
      const res = await request
        .post('/api/users/login')
        .send({
          user: {
            email: testUser.user.email,
            password: testUser.user.password
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.token).toBeDefined();
    });

    test('POST /api/users/login - Should reject invalid password with 422', async () => {
      const res = await request
        .post('/api/users/login')
        .send({
          user: {
            email: testUser.user.email,
            password: 'incorrect_password'
          }
        });

      expect(res.status).toBe(422);
    });

    test('GET /api/user - Should return current user when authenticated (200)', async () => {
      if (!token) return;
      const res = await request
        .get('/api/user')
        .set('Authorization', `Token ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe(testUser.user.username.toLowerCase());
    });

    test('GET /api/user - Should return 401 without authorization header', async () => {
      const res = await request.get('/api/user');
      expect(res.status).toBe(401);
    });
  });

  describe('3. Articles CRUD Endpoints', () => {
    test('POST /api/articles - Should create a new article with valid token (200)', async () => {
      if (!token) return;
      const res = await request
        .post('/api/articles')
        .set('Authorization', `Token ${token}`)
        .send({
          article: {
            title: `Automated Pipeline Article ${randomSuffix}`,
            description: 'Automated testing with SuperTest',
            body: 'Comprehensive guide to building CI/CD test harness.',
            tagList: ['cicd', 'supertest', 'jest']
          }
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.article).toBeDefined();
      expect(res.body.article.slug).toBeDefined();
      createdSlug = res.body.article.slug;
    });

    test('POST /api/articles - Should return 401 when unauthenticated', async () => {
      const res = await request
        .post('/api/articles')
        .send({
          article: {
            title: 'Unauthenticated Article',
            description: 'Desc',
            body: 'Body'
          }
        });

      expect(res.status).toBe(401);
    });

    test('GET /api/articles - Should list articles with pagination (200)', async () => {
      const res = await request.get('/api/articles?limit=10&offset=0');
      expect([200, 304]).toContain(res.status);
      expect(res.body).toHaveProperty('articles');
      expect(Array.isArray(res.body.articles)).toBe(true);
    });

    test('GET /api/articles/:slug - Should get article by slug (200)', async () => {
      if (!createdSlug) return;
      const res = await request.get(`/api/articles/${createdSlug}`);
      expect(res.status).toBe(200);
      expect(res.body.article.slug).toBe(createdSlug);
    });

    test('GET /api/articles/:slug - Should return 404 for non-existent slug', async () => {
      const res = await request.get('/api/articles/non-existent-article-slug-xyz');
      expect([404, 422]).toContain(res.status);
    });
  });

  describe('4. Profiles & Comments Endpoints', () => {
    test('GET /api/profiles/:username - Should fetch profile (200)', async () => {
      const res = await request.get(`/api/profiles/${testUser.user.username.toLowerCase()}`);
      expect(res.status).toBe(200);
      expect(res.body.profile.username).toBe(testUser.user.username.toLowerCase());
    });

    test('POST /api/articles/:slug/comments - Should add a comment with auth (200)', async () => {
      if (!token || !createdSlug) return;
      const res = await request
        .post(`/api/articles/${createdSlug}/comments`)
        .set('Authorization', `Token ${token}`)
        .send({
          comment: {
            body: 'Great automated test article!'
          }
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.comment).toBeDefined();
      expect(res.body.comment.body).toBe('Great automated test article!');
    });

    test('GET /api/articles/:slug/comments - Should list comments for article (200)', async () => {
      if (!createdSlug) return;
      const res = await request.get(`/api/articles/${createdSlug}/comments`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('comments');
      expect(Array.isArray(res.body.comments)).toBe(true);
    });
  });
});
