import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { createMockRepository, MockRepository } from '../../test/mocks/repository.mock';
import { createUserFixture } from '../../test/fixtures/user.fixture';
import { messages } from '../../constants/messages.constants';

describe('UsersService', () => {
  let service: UsersService;
  let repo: MockRepository<User>;

  beforeEach(async () => {
    repo = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: getRepositoryToken(User), useValue: repo }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should create and save a new user', async () => {
      const fixture = createUserFixture();
      repo.create!.mockReturnValue(fixture);
      repo.save!.mockResolvedValue(fixture);

      const result = await service.create({ email: 'test@example.com', password: 'hashed' });

      expect(repo.create).toHaveBeenCalledWith({ email: 'test@example.com', password: 'hashed' });
      expect(repo.save).toHaveBeenCalledWith(fixture);
      expect(result).toEqual(fixture);
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('should return paginated results with default page and limit', async () => {
      const fixture = createUserFixture();
      const qb = repo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[fixture], 1]);

      const result = await service.findAll();

      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(result.items).toEqual([fixture]);
      expect(result.meta).toMatchObject({ total: 1, page: 1, limit: 20, total_pages: 1 });
    });

    it('should apply search filters when search param is provided', async () => {
      const qb = repo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ search: 'john' });

      expect(qb.where).toHaveBeenCalledWith('user.email LIKE :search', { search: '%john%' });
      expect(qb.orWhere).toHaveBeenCalledTimes(2);
    });

    it('should respect custom page and limit values', async () => {
      const qb = repo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 3, limit: 5 });

      expect(qb.skip).toHaveBeenCalledWith(10); // (3-1) * 5 = 10
      expect(qb.take).toHaveBeenCalledWith(5);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('should return the user when found', async () => {
      const fixture = createUserFixture();
      repo.findOneBy!.mockResolvedValue(fixture);

      const result = await service.findOne(1);
      expect(result).toEqual(fixture);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      repo.findOneBy!.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow(messages.USER_NOT_FOUND);
    });
  });

  // ─── findByEmail ──────────────────────────────────────────────────────────

  describe('findByEmail()', () => {
    it('should return the user when email is found', async () => {
      const fixture = createUserFixture();
      repo.findOne!.mockResolvedValue(fixture);

      const result = await service.findByEmail('test@example.com');
      expect(result).toEqual(fixture);
    });

    it('should return null when email is not found', async () => {
      repo.findOne!.mockResolvedValue(null);

      const result = await service.findByEmail('nobody@test.com');
      expect(result).toBeNull();
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('should merge and save updates when user exists', async () => {
      const fixture = createUserFixture();
      const updated = createUserFixture({ first_name: 'Updated' });
      repo.findOneBy!.mockResolvedValue(fixture);
      repo.merge!.mockReturnValue(updated);
      repo.save!.mockResolvedValue(updated);

      const result = await service.update(1, { first_name: 'Updated' });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      repo.findOneBy!.mockResolvedValue(null);

      await expect(service.update(999, { first_name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('should delete the user when found', async () => {
      repo.delete!.mockResolvedValue({ affected: 1 });

      await expect(service.remove(1)).resolves.toBeUndefined();
      expect(repo.delete).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when no rows are affected', async () => {
      repo.delete!.mockResolvedValue({ affected: 0 });

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
      await expect(service.remove(999)).rejects.toThrow(messages.USER_NOT_FOUND);
    });
  });
});
