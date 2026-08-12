import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { JwtStrategy } from '../src/modules/auth/guards/jwt.strategy';
import { UsersService } from '../src/modules/users/users.service';
import { User } from '../src/modules/users/entities/user.entity';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { createMockRepository } from '../src/test/mocks/repository.mock';
import { createUserFixture } from '../src/test/fixtures/user.fixture';

jest.mock('bcryptjs');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('Auth (E2E)', () => {
  let app: NestFastifyApplication;
  let repo: ReturnType<typeof createMockRepository>;

  beforeAll(async () => {
    repo = createMockRepository();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PassportModule,
        JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '1d' } }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
      ],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(new ValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.clearAllMocks());

  // ─── POST /auth/signup ────────────────────────────────────────────────────

  describe('POST /auth/signup', () => {
    it('should return 201 with user data on success', async () => {
      const fixture = createUserFixture();
      repo.findOne.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed' as never);
      repo.create.mockReturnValue(fixture);
      repo.save.mockResolvedValue(fixture);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { email: 'user@test.com', password: 'secret123' },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json<{
        success: boolean;
        data: { user: { id: number; email: string } };
      }>();
      expect(body.success).toBe(true);
    });

    it('should return 400 when email is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { password: 'secret123' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json<{ success: boolean }>();
      expect(body.success).toBe(false);
    });

    it('should return 400 when email format is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { email: 'bad-email', password: 'secret123' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when password is shorter than 6 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { email: 'user@test.com', password: '123' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json<{ message: string }>();
      expect(body.message).toBe('Password must be at least 6 characters long');
    });

    it('should return 409 when email is already in use', async () => {
      repo.findOne.mockResolvedValue(createUserFixture());

      const response = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { email: 'user@test.com', password: 'secret123' },
      });

      expect(response.statusCode).toBe(409);
      const body = response.json<{ success: boolean; status_code: number }>();
      expect(body.success).toBe(false);
      expect(body.status_code).toBe(409);
    });
  });

  // ─── POST /auth/login ─────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('should return 200 with access_token on valid credentials', async () => {
      const fixture = createUserFixture();
      repo.findOne.mockResolvedValue(fixture);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'test@example.com', password: 'secret123' },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json<{ success: boolean; data: { access_token: string } }>();
      expect(body.success).toBe(true);
      expect(body.data.access_token).toBeDefined();
    });

    it('should return 400 when password is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'user@test.com' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when email format is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'not-an-email', password: 'secret123' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 401 when password is incorrect', async () => {
      const fixture = createUserFixture();
      // findByEmail internally calls repo.findOne
      repo.findOne.mockResolvedValue(fixture);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'test@example.com', password: 'wrong-password-123' },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
