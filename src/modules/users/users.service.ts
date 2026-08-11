import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { messages } from '../../constants/messages.constants';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    @InjectRepository(User)
    private users_repository: Repository<User>,
  ) {}

  async create(create_user_dto: CreateUserDto & { password?: string }): Promise<User> {
    const user = this.users_repository.create(create_user_dto);
    return this.users_repository.save(user);
  }

  async findAll(query?: { search?: string; page?: number; limit?: number }) {
    const { search, page = 1, limit = 20 } = query || {};
    const skip = (page - 1) * limit;

    const query_builder = this.users_repository.createQueryBuilder('user');

    if (search) {
      query_builder
        .where('user.email LIKE :search', { search: `%${search}%` })
        .orWhere('user.first_name LIKE :search', { search: `%${search}%` })
        .orWhere('user.last_name LIKE :search', { search: `%${search}%` });
    }

    const [items, total] = await query_builder.skip(skip).take(limit).getManyAndCount();

    return {
      items,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const user = await this.users_repository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(messages.USER_NOT_FOUND);
    }
    return user;
  }

  async findByEmail(email: string) {
    const user = await this.users_repository.findOne({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        first_name: true,
        last_name: true,
        created_at: true,
        updated_at: true,
        deleted_at: true,
      },
    });
    return user;
  }

  async update(id: number, update_user_dto: UpdateUserDto) {
    const user = await this.findOne(id);
    const updated_user = this.users_repository.merge(user, update_user_dto);
    return this.users_repository.save(updated_user);
  }

  async remove(id: number): Promise<void> {
    const result = await this.users_repository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(messages.USER_NOT_FOUND);
    }
  }
}
