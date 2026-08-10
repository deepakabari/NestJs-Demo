import { Controller, Get, Query, Request } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  async getPayments(@Query() query: any, @Request() req: any) {
    // Usually user_id comes from req.user.id after authentication middleware/guard
    // For now we will mock it or extract it from query/req based on your setup
    const user_id = req.user?.id || query.user_id;
    
    if (!user_id) {
      throw new Error('user_id is required');
    }

    return this.paymentsService.getPayments(query, user_id);
  }
}
