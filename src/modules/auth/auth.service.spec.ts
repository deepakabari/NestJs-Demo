import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { mockJwtService } from '../../test/mocks/jwt.mock';
import { createUserFixture } from '../../test/fixtures/user.fixture';

// Mock bcryptjs so tests never do real hashing
jest.mock('bcryptjs');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

/** Minimal UsersService mock — only the methods AuthService calls */
const mockUsersService = {
  findByEmail: jest.fn(),
  create: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── signup ───────────────────────────────────────────────────────────────

  describe('signup()', () => {
    it('should create a new user and return id + email on success', async () => {
      const fixture = createUserFixture();
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
      mockUsersService.create.mockResolvedValue(fixture);

      const result = await service.signup({
        email: 'test@example.com',
        password: 'secret123',
        first_name: 'Test',
        last_name: 'User',
      });

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('secret123', 10);
      expect(result).toEqual({
        message: 'User created successfully',
        user: { id: fixture.id, email: fixture.email },
      });
    });

    it('should throw ConflictException when email is already in use', async () => {
      mockUsersService.findByEmail.mockResolvedValue(createUserFixture());

      await expect(
        service.signup({ email: 'test@example.com', password: 'secret123' }),
      ).rejects.toThrow(ConflictException);

      expect(mockUsersService.create).not.toHaveBeenCalled();
    });
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login()', () => {
    it('should return access_token when credentials are valid', async () => {
      mockUsersService.findByEmail.mockResolvedValue(createUserFixture());
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.login({ email: 'test@example.com', password: 'secret123' });

      expect(mockJwtService.sign).toHaveBeenCalledWith({ user_id: 1, email: 'test@example.com' });
      expect(result).toEqual({ access_token: 'mock-access-token' });
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@test.com', password: 'secret123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user has no password', async () => {
      mockUsersService.findByEmail.mockResolvedValue(
        createUserFixture({ password: undefined as unknown as string }),
      );

      await expect(
        service.login({ email: 'test@example.com', password: 'secret123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      mockUsersService.findByEmail.mockResolvedValue(createUserFixture());
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
