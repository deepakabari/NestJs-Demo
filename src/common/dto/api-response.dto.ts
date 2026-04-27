import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiResponseDto<T> {
  @ApiProperty({ example: true, description: 'Indicates if the request was successful' })
  success: boolean;

  @ApiProperty({ example: 200, description: 'HTTP status code' })
  status_code: number;

  @ApiProperty({ example: 'Success', description: 'Response message' })
  message: string;

  @ApiProperty({ description: 'Response data payload' })
  data: T;
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 400, description: 'HTTP status code' })
  status_code: number;

  @ApiProperty({ example: 'Validation failed', description: 'Error message' })
  message: string;

  @ApiPropertyOptional({ example: null, nullable: true, description: 'Application error code' })
  error_code: string | number | null;

  @ApiProperty({ example: '2026-04-27T10:00:00.000Z', description: 'ISO timestamp' })
  timestamp: string;

  @ApiProperty({ example: '/users', description: 'Request path' })
  path: string;
}
