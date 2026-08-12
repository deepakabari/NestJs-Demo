import { of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';
import { messages } from '../../constants/messages.constants';

/** Creates a minimal mock ExecutionContext and CallHandler for the interceptor */
const createMockContext = (statusCode = 200) => {
  const mockRequest = {} as Record<string, unknown>;
  const mockResponse = { statusCode };

  const executionContext = {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(mockRequest),
      getResponse: jest.fn().mockReturnValue(mockResponse),
    }),
  };

  return { executionContext, mockRequest };
};

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
  });

  it('should wrap plain data with default SUCCESS message', (done) => {
    const { executionContext } = createMockContext(200);
    const callHandler = { handle: () => of({ id: 1, name: 'Test' }) };

    interceptor.intercept(executionContext as never, callHandler).subscribe((result) => {
      expect(result).toEqual({
        success: true,
        status_code: 200,
        message: messages.SUCCESS,
        data: { id: 1, name: 'Test' },
      });
      done();
    });
  });

  it('should hoist { message, data } shape from service response', (done) => {
    const { executionContext } = createMockContext(201);
    const serviceResponse = { message: 'User created.', data: { id: 5 } };
    const callHandler = { handle: () => of(serviceResponse) };

    interceptor.intercept(executionContext as never, callHandler).subscribe((result) => {
      expect(result).toEqual({
        success: true,
        status_code: 201,
        message: 'User created.',
        data: { id: 5 },
      });
      done();
    });
  });

  it('should set data to null when service returns { message } with no data', (done) => {
    const { executionContext } = createMockContext(200);
    const callHandler = { handle: () => of({ message: 'Deleted.' }) };

    interceptor.intercept(executionContext as never, callHandler).subscribe((result) => {
      expect(result.data).toBeNull();
      expect(result.message).toBe('Deleted.');
      done();
    });
  });

  it('should set resMessage on the request object', (done) => {
    const { executionContext, mockRequest } = createMockContext(200);
    const callHandler = { handle: () => of({ message: 'Profile updated.', data: null }) };

    interceptor.intercept(executionContext as never, callHandler).subscribe(() => {
      expect(mockRequest['resMessage']).toBe('Profile updated.');
      done();
    });
  });

  it('should set data to null when service returns { message, data: null }', (done) => {
    const { executionContext } = createMockContext(200);
    const callHandler = { handle: () => of({ message: 'Deleted.', data: null }) };

    interceptor.intercept(executionContext as never, callHandler).subscribe((result) => {
      expect(result.data).toBeNull();
      done();
    });
  });
  it('should fallback to default SUCCESS message if data.message is undefined', (done) => {
    const { executionContext } = createMockContext(200);
    const callHandler = { handle: () => of({ message: undefined, data: { foo: 'bar' } }) };

    interceptor.intercept(executionContext as never, callHandler).subscribe((result) => {
      expect(result.message).toBe(messages.SUCCESS);
      expect(result.data).toEqual({ foo: 'bar' });
      done();
    });
  });
});
