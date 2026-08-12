import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { createUserFixture } from '../../test/fixtures/user.fixture';
import { messages } from '../../constants/messages.constants';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';

const mockUsersService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    })
      // Override the guard so JWT verification is bypassed in unit tests
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should create a user and return wrapped response', async () => {
      const fixture = createUserFixture();
      const dto: CreateUserDto = { email: 'user@test.com' };
      mockUsersService.create.mockResolvedValue(fixture);

      const result = await controller.create(dto);

      expect(mockUsersService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ message: messages.USER_CREATED, data: fixture });
    });
  });

  // ─── getMyProfile ─────────────────────────────────────────────────────────

  describe('getMyProfile()', () => {
    it('should return the authenticated user profile', () => {
      const fixture = createUserFixture();
      const result = controller.getMyProfile(fixture);

      expect(result).toEqual({ message: messages.USER_FETCHED, data: fixture });
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('should call findAll with no query params', async () => {
      const paginatedResult = { items: [], meta: { total: 0, page: 1, limit: 20, total_pages: 0 } };
      mockUsersService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll();

      expect(mockUsersService.findAll).toHaveBeenCalledWith({
        search: undefined,
        page: undefined,
        limit: undefined,
      });
      expect(result).toEqual({ message: messages.USERS_FETCHED, data: paginatedResult });
    });

    it('should parse page and limit strings to numbers', async () => {
      mockUsersService.findAll.mockResolvedValue({ items: [], meta: {} });

      await controller.findAll('john', '2', '10');

      expect(mockUsersService.findAll).toHaveBeenCalledWith({ search: 'john', page: 2, limit: 10 });
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('should return the user by id', async () => {
      const fixture = createUserFixture();
      mockUsersService.findOne.mockResolvedValue(fixture);

      const result = await controller.findOne(1);

      expect(mockUsersService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual({ message: messages.USER_FETCHED, data: fixture });
    });
  });

  // ─── updateProfile ────────────────────────────────────────────────────────

  describe('updateProfile()', () => {
    it('should update the profile of the authenticated user', async () => {
      const fixture = createUserFixture({ first_name: 'Updated' });
      const dto: UpdateUserDto = { first_name: 'Updated' };
      mockUsersService.update.mockResolvedValue(fixture);

      const result = await controller.updateProfile(1, dto);

      expect(mockUsersService.update).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual({ message: messages.PROFILE_UPDATED, data: fixture });
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('should update a user by id', async () => {
      const fixture = createUserFixture({ last_name: 'Smith' });
      const dto: UpdateUserDto = { last_name: 'Smith' };
      mockUsersService.update.mockResolvedValue(fixture);

      const result = await controller.update(1, dto);

      expect(mockUsersService.update).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual({ message: messages.USER_UPDATED, data: fixture });
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('should delete a user by id and return null data', async () => {
      mockUsersService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(1);

      expect(mockUsersService.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual({ message: messages.USER_DELETED, data: null });
    });
  });
});
