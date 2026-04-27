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
    private usersRepository: Repository<User>,
    private encryptionService: EncryptionService,
    private kmsEnvelopeService: KmsEnvelopeService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    if (!createUserDto.mnemonic) {
      createUserDto.mnemonic = bip39.generateMnemonic();
    }

    this.logger.debug(`[DEBUG] Generated Mnemonic for new user: ${createUserDto.mnemonic}`);

    // Encrypt explicitly via async service call
    createUserDto.mnemonic = await this.kmsEnvelopeService.encryptMnemonic(createUserDto.mnemonic);
    
    const user = this.usersRepository.create(createUserDto);
    
    // Set email hash for fast lookup and uniqueness
    if (user.email) {
      user.emailHash = this.encryptionService.hash(user.email);
    }
    
    return this.usersRepository.save(user);
  }

  async findAll(query?: { search?: string; page?: number; limit?: number }) {
    const { search, page = 1, limit = 10 } = query || {};
    const skip = (page - 1) * limit;

    const queryBuilder = this.usersRepository.createQueryBuilder('user');

    if (search) {
      // For encrypted data, we use exact match on hash for performance
      const searchHash = this.encryptionService.hash(search);
      queryBuilder.where('user.emailHash = :searchHash', { searchHash });
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

  async revealMnemonic(id: number, userPin?: string): Promise<string> {
    const user = await this.findOne(id);
    if (!user.mnemonic) {
      throw new NotFoundException('Mnemonic not found for this user');
    }
    
    // Decrypt explicitly only when specifically requested
    const mnemonic = await this.kmsEnvelopeService.decryptMnemonic(user.mnemonic, userPin, id);
    this.logger.debug(`[DEBUG] Revealed Mnemonic for user ${id}: ${mnemonic}`);
    return mnemonic;
  }

  async findByEmail(email: string) {
    const emailHash = this.encryptionService.hash(email);
    const user = await this.usersRepository.findOneBy({ emailHash });
    return user;
  }

  async findBySub(sub: string) {
    return this.usersRepository.findOneBy({ cognitoSub: sub });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(id);

    if (updateUserDto.email) {
      user.emailHash = this.encryptionService.hash(updateUserDto.email);
    }

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
