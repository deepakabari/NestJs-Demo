import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { messages } from '../../constants/messages.constants';
import * as bip39 from 'bip39';
import { EncryptionService } from '../encryption/encryption.service';
import { KmsEnvelopeService } from '../encryption/kms-envelope.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    @InjectRepository(User)
    private users_repository: Repository<User>,
    private encryption_service: EncryptionService,
    private kms_envelope_service: KmsEnvelopeService,
  ) {}

  async create(create_user_dto: CreateUserDto): Promise<User> {
    if (!create_user_dto.mnemonic) {
      create_user_dto.mnemonic = bip39.generateMnemonic();
    }

    // Encrypt explicitly via async service call
    // create_user_dto.mnemonic = await this.kms_envelope_service.encryptMnemonic(
    //   create_user_dto.mnemonic,
    // );

    const user = this.users_repository.create(create_user_dto);

    // Set email hash for fast lookup and uniqueness
    if (user.email) {
      user.email_hash = this.encryption_service.hash(user.email);
    }

    return this.users_repository.save(user);
  }

  async findAll(query?: { search?: string; page?: number; limit?: number }) {
    const { search, page = 1, limit = 20 } = query || {};
    const skip = (page - 1) * limit;

    const query_builder = this.users_repository.createQueryBuilder('user');

    if (search) {
      // For encrypted data, we use exact match on hash for performance
      const search_hash = this.encryption_service.hash(search);
      query_builder.where('user.email_hash = :search_hash', { search_hash });
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

  async revealMnemonic(id: number, user_pin?: string): Promise<string> {
    const user = await this.findOne(id);
    if (!user.mnemonic) {
      throw new NotFoundException('Mnemonic not found for this user');
    }

    // Decrypt explicitly only when specifically requested
    const mnemonic = await this.kms_envelope_service.decryptMnemonic(user.mnemonic, user_pin, id);
    return mnemonic;
  }

  async findByEmail(email: string) {
    const email_hash = this.encryption_service.hash(email);
    const user = await this.users_repository.findOneBy({ email_hash });
    return user;
  }

  async findBySub(sub: string) {
    return this.users_repository.findOneBy({ cognito_sub: sub });
  }

  async update(id: number, update_user_dto: UpdateUserDto) {
    const user = await this.findOne(id);

    if (update_user_dto.email) {
      user.email_hash = this.encryption_service.hash(update_user_dto.email);
    }

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
