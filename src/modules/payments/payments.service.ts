import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Payment } from './entities/payment.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async getPayments(query: any, user_id: string) {
    const { asset_id, status, page = '1', limit = '10' } = query;

    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 10;

    // Build base where conditions
    const baseWhere: FindOptionsWhere<Payment> = {};

    // Partial + case-insensitive match
    if (asset_id) {
      baseWhere.asset_id = asset_id;
    }

    if (status) {
      baseWhere.status = status;
    }

    // Combine with user_id match (either sender or receiver)
    const where: FindOptionsWhere<Payment>[] = [
      { ...baseWhere, sender_user_id: user_id },
      { ...baseWhere, receiver_user_id: user_id },
    ];
    
    console.log('QUERY START::::--------------------');
    
    // Fetch with pagination
    const [items, total] = await this.paymentRepository.findAndCount({
      where,
      relations: {
        sender_user: true,
        receiver_user: true,
        asset: true,
      },
      select: {
        id: true,
        client_request_id: true,
        sender_user_id: true,
        receiver_user_id: true,
        asset_id: true,
        amount: true,
        status: true,
        sender_user: {
          first_name: true,
          last_name: true,
        },
        receiver_user: {
          first_name: true,
          last_name: true,
        },
        asset: {
          asset_code: true, // Assuming Asset has this field based on the query structure
        },
        created_at: true,
      },
      skip: (pageNumber - 1) * limitNumber,
      take: limitNumber,
      order: {
        created_at: 'DESC',
      },
    });

    return {
      items,
      total,
      page: pageNumber,
      limit: limitNumber,
    };
  }
}
