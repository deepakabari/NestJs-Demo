import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { messages } from '../../constants/messages.constants';
import * as bip39 from 'bip39';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    if (!createUserDto.mnemonic) {
      createUserDto.mnemonic = bip39.generateMnemonic();
    }
    const user = this.usersRepository.create(createUserDto);
    return this.usersRepository.save(user);
  }

  async findAll(query?: { search?: string; page?: number; limit?: number }) {
    const { search, page = 1, limit = 10 } = query || {};
    const skip = (page - 1) * limit;

    const queryBuilder = this.usersRepository.createQueryBuilder('user');

    if (search) {
      queryBuilder.where('user.email LIKE :search OR user.firstName LIKE :search OR user.lastName LIKE :search', {
        search: `%${search}%`,
      });
    }

    const [items, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(messages.USER_NOT_FOUND);
    }
    return user;
  }

  async findByEmail(email: string) {
    const user = await this.usersRepository.findOneBy({ email });
    return user;
  }

  async findBySub(sub: string) {
    return this.usersRepository.findOneBy({ cognitoSub: sub });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(id);

    const updatedUser = this.usersRepository.merge(user, updateUserDto);
    return this.usersRepository.save(updatedUser);
  }

  async remove(id: number): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(messages.USER_NOT_FOUND);
    }
  }
}
