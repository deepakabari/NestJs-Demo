import type { Repository } from 'typeorm';

/**
 * Creates a typed mock of a TypeORM Repository.
 * Import this factory in every service spec file instead of duplicating mocks.
 *
 * Usage:
 *   const mockRepo = createMockRepository();
 *   providers: [{ provide: getRepositoryToken(User), useValue: mockRepo }]
 */
export const createMockRepository = () => ({
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  merge: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  }),
});

export type MockRepository<T extends object> = Partial<Record<keyof Repository<T>, jest.Mock>> & {
  createQueryBuilder: jest.Mock;
};
