import { ClassSerializerInterceptor } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { ValidationPipe } from './common/pipes/validation.pipe';
import cookieParser from 'cookie-parser';

import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Enable CORS with credentials support to allow cookies cross-origin
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  });

  // Use cookie-parser (required to read HttpOnly and CSRF cookies)
  app.use(cookieParser(process.env.COOKIE_SECRET || 'fallback_secret_for_dev'));

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('NestJS Demo API')
    .setDescription(
      'REST API for user management with AWS Cognito authentication and KMS envelope encryption',
    )
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .addTag('Users', 'User CRUD operations')
    .addTag('Cognito Auth', 'Authentication via AWS Cognito')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Serve test HTML files from the project root directory
  app.useStaticAssets(process.cwd());

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
