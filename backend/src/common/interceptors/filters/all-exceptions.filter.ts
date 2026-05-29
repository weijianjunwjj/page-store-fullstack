import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const traceId = randomUUID();

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'SYS_UNKNOWN_001';
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const resp = exception.getResponse();
      message = typeof resp === 'string' ? resp : (resp as any).message;
      code = `HTTP_${httpStatus}`; // 或按 5/14 码表映射
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      httpStatus = HttpStatus.BAD_REQUEST;
      code = `DB_${exception.code}`; // P2002 等
      message = 'Database request error';
    }

    res.status(httpStatus).json({ code, data: null, message, traceId });
  }
}