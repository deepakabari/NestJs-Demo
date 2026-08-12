import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';
import { mockConfigService } from '../../../test/mocks/config.mock';
import { createUserFixture } from '../../../test/fixtures/user.fixture';

const mockUsersService = {
  findOne: jest.fn(),
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined and read JWT_SECRET from config on construction', () => {
    expect(strategy).toBeDefined();
    expect(mockConfigService.getOrThrow).toHaveBeenCalledWith('JWT_SECRET');
  });

  describe('validate()', () => {
    it('should return the user when the JWT payload is valid', async () => {
      const fixture = createUserFixture();
      mockUsersService.findOne.mockResolvedValue(fixture);

      const result = await strategy.validate({ user_id: 1, email: 'test@example.com' });

      expect(mockUsersService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(fixture);
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      mockUsersService.findOne.mockResolvedValue(null);

      await expect(strategy.validate({ user_id: 999, email: 'ghost@test.com' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
