import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

const mockAuthService = {
  signup: jest.fn(),
  login: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('signup()', () => {
    it('should delegate to auth_service.signup and return the result', async () => {
      const dto: SignupDto = { email: 'user@test.com', password: 'secret123' };
      const expected = { message: 'User created successfully', user: { id: 1, email: dto.email } };
      mockAuthService.signup.mockResolvedValue(expected);

      const result = await controller.signup(dto);

      expect(mockAuthService.signup).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('login()', () => {
    it('should delegate to auth_service.login and return access_token', async () => {
      const dto: LoginDto = { email: 'user@test.com', password: 'secret123' };
      const expected = { access_token: 'mock-access-token' };
      mockAuthService.login.mockResolvedValue(expected);

      const result = await controller.login(dto);

      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });
});
