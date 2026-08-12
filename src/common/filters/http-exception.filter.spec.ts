import { HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';
import { messages } from '../../constants/messages.constants';

/** Creates a minimal mock of ArgumentsHost for Fastify HTTP context */
const createMockHost = () => {
  const mockSend = jest.fn();
  const mockStatus = jest.fn().mockReturnValue({ send: mockSend });
  const mockRequest = {} as Record<string, unknown>;

  return {
    host: {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue({ status: mockStatus }),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    },
    mockStatus,
    mockSend,
    mockRequest,
  };
};

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it('should handle HttpException with a string response', () => {
    const { host, mockStatus, mockSend } = createMockHost();
    filter.catch(new HttpException('Custom error message', HttpStatus.BAD_REQUEST), host as never);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Custom error message' }),
    );
  });

  it('should handle HttpException with an object response containing error_code', () => {
    const { host, mockStatus, mockSend } = createMockHost();
    filter.catch(
      new HttpException({ message: 'Conflict', error_code: 'ERR_001' }, HttpStatus.CONFLICT),
      host as never,
    );

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ error_code: 'ERR_001', message: 'Conflict' }),
    );
  });

  it('should handle HttpException with an object response without error_code', () => {
    const { host, mockSend } = createMockHost();
    filter.catch(new HttpException({ message: 'Not Found' }, HttpStatus.NOT_FOUND), host as never);

    const sentBody = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(sentBody['error_code']).toBeUndefined();
  });

  it('should fallback to exception.message if object response lacks a message', () => {
    const { host, mockSend } = createMockHost();
    filter.catch(
      new HttpException({ error_code: 'NO_MSG' }, HttpStatus.BAD_REQUEST),
      host as never,
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Http Exception', error_code: 'NO_MSG' }),
    );
  });

  it('should handle DB duplicate entry error (ER_DUP_ENTRY) with 409', () => {
    const { host, mockStatus, mockSend } = createMockHost();
    filter.catch({ code: 'ER_DUP_ENTRY', message: 'Duplicate' }, host as never);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: messages.DUPLICATE_EMAIL }),
    );
  });

  it('should handle DB duplicate entry error (23505 — Postgres) with 409', () => {
    const { host, mockStatus } = createMockHost();
    filter.catch({ code: '23505', message: 'Duplicate' }, host as never);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
  });

  it('should handle unknown error with a message field as 500', () => {
    const { host, mockStatus, mockSend } = createMockHost();
    filter.catch({ message: 'Something broke' }, host as never);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Something broke' }),
    );
  });

  it('should fallback to default 500 message for unknown error object without message', () => {
    const { host, mockStatus, mockSend } = createMockHost();
    filter.catch({ code: 'RANDOM_ERROR' }, host as never);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ message: messages.INTERNAL_SERVER_ERROR }),
    );
  });

  it('should fallback to default INTERNAL_SERVER_ERROR message for completely unknown exceptions', () => {
    const { host, mockStatus, mockSend } = createMockHost();
    filter.catch('a random thrown string', host as never);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ message: messages.INTERNAL_SERVER_ERROR }),
    );
  });

  it('should set resMessage on the request object', () => {
    const { host, mockRequest } = createMockHost();
    filter.catch(new HttpException('Test', HttpStatus.BAD_REQUEST), host as never);

    expect(mockRequest['resMessage']).toBe('Test');
  });
  it('should handle HttpException with a non-string and non-object response', () => {
    const { host, mockSend } = createMockHost();
    filter.catch(new HttpException(true as never, HttpStatus.BAD_REQUEST), host as never);

    const sentBody = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(sentBody['message']).toBe('Http Exception');
  });
});
