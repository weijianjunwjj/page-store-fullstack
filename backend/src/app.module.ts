import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { LoggerModule } from 'nestjs-pino';
import { PageConfigModule } from './page-config/page-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
     // ...已有的 ConfigModule、PrismaModule、HealthModule
    PageConfigModule,
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
