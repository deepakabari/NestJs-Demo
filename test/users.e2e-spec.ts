import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';

import { UsersController } from '../src/modules/users/users.controller';
import { UsersService } from '../src/modules/users/users.service';
import { JwtStrategy } from '../src/modules/auth/guards/jwt.strategy';
import { User } from '../src/modules/users/entities/user.entity';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { createMockRepository } from '../src/test/mocks/repository.mock';
import { createUserFixture } from '../src/test/fixtures/user.fixture';
import { messages } from '../src/constants/messages.constants';

const TEST_JWT_SECRET = 'test-secret';

describe('Users (E2E)', () => {
  let app: NestFastifyApplication;
  let repo: ReturnType<typeof createMockRepository>;
  let authToken: string;

  beforeAll(async () => {
    repo = createMockRepository();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ JWT_SECRET: TEST_JWT_SECRET })],
        }),
        PassportModule,
        JwtModule.register({ secret: TEST_JWT_SECRET, signOptions: { expiresIn: '1d' } }),
      ],
      controllers: [UsersController],
      providers: [UsersService, JwtStrategy, { provide: getRepositoryToken(User), useValue: repo }],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(new ValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    // Generate a real JWT signed with the test secret for authenticated requests
    const jwtService = moduleFixture.get<JwtService>(JwtService);
    authToken = jwtService.sign({ user_id: 1, email: 'test@example.com' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // By default, JwtStrategy.validate() calls findOne — stub it to return a fixture user
    repo.findOneBy.mockResolvedValue(createUserFixture());
  });

  afterEach(() => jest.clearAllMocks());

  const authHeader = () => ({ Authorization: `Bearer ${authToken}` });

  // ─── GET /users ───────────────────────────────────────────────────────────

  describe('GET /users', () => {
    it('should return 401 when no token is provided', async () => {
      const response = await app.inject({ method: 'GET', url: '/users' });
      expect(response.statusCode).toBe(401);
    });

    it('should return 200 with paginated list when authenticated', async () => {
      const fixture = createUserFixture();
      repo.createQueryBuilder().getManyAndCount.mockResolvedValue([[fixture], 1]);

      const response = await app.inject({
        method: 'GET',
        url: '/users',
        headers: authHeader(),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ success: boolean; data: { items: User[] } }>();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('items');
    });
  });

  // ─── GET /users/me ────────────────────────────────────────────────────────

  describe('GET /users/me', () => {
    it('should return the authenticated user profile', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/users/me',
        headers: authHeader(),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { email: string } }>();
      expect(body.data.email).toBe('test@example.com');
    });
  });

  // ─── GET /users/:id ───────────────────────────────────────────────────────

  describe('GET /users/:id', () => {
    it('should return 200 with user data when user exists', async () => {
      const fixture = createUserFixture({ id: 5 });
      repo.findOneBy
        .mockResolvedValueOnce(createUserFixture()) // JWT validate call
        .mockResolvedValueOnce(fixture); // findOne call

      const response = await app.inject({
        method: 'GET',
        url: '/users/5',
        headers: authHeader(),
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 when user does not exist', async () => {
      // First call: JWT validate (return auth user); second call: findOne for route
      repo.findOneBy.mockResolvedValueOnce(createUserFixture()).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: '/users/999',
        headers: authHeader(),
      });

      expect(response.statusCode).toBe(404);
      const body = response.json<{ message: string }>();
      expect(body.message).toBe(messages.USER_NOT_FOUND);
    });
  });

  // ─── POST /users ──────────────────────────────────────────────────────────

  describe('POST /users', () => {
    it('should return 201 when a valid user is created', async () => {
      const fixture = createUserFixture();
      repo.create.mockReturnValue(fixture);
      repo.save.mockResolvedValue(fixture);

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        headers: authHeader(),
        payload: { email: 'new@test.com' },
      });

      expect(response.statusCode).toBe(201);
    });

    it('should return 400 when email format is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/users',
        headers: authHeader(),
        payload: { email: 'bad-email' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ─── PATCH /users/:id ─────────────────────────────────────────────────────

  describe('PATCH /users/:id', () => {
    it('should return 200 with updated user', async () => {
      const fixture = createUserFixture({ first_name: 'Updated' });
      repo.findOneBy.mockResolvedValue(fixture);
      repo.merge.mockReturnValue(fixture);
      repo.save.mockResolvedValue(fixture);

      const response = await app.inject({
        method: 'PATCH',
        url: '/users/1',
        headers: authHeader(),
        payload: { first_name: 'Updated' },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 400 when email update has invalid format', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/users/1',
        headers: authHeader(),
        payload: { email: 'invalid-email' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ─── DELETE /users/:id ────────────────────────────────────────────────────

  describe('DELETE /users/:id', () => {
    it('should return 200 with null data when user is deleted', async () => {
      repo.delete.mockResolvedValue({ affected: 1 });

      const response = await app.inject({
        method: 'DELETE',
        url: '/users/1',
        headers: authHeader(),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: null }>();
      expect(body.data).toBeNull();
    });

    it('should return 404 when user does not exist', async () => {
      repo.findOneBy.mockResolvedValueOnce(createUserFixture()); // JWT validate
      repo.delete.mockResolvedValue({ affected: 0 });

      const response = await app.inject({
        method: 'DELETE',
        url: '/users/999',
        headers: authHeader(),
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
