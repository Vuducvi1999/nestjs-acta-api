import 'dotenv/config';
import './instrument';

import {
  BadRequestException,
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AllConfigType } from './common/configs/types/index.type';
import { ResolvePromisesInterceptor } from './common/utils';
import { PrismaService } from './common/services/prisma.service';

// Prisma shutdown handling

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Make class-validator use Nest DI (so custom validators can inject services)
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  const configService = app.get(ConfigService<AllConfigType>);

  /**
   * CORS
   * - origin: true -> reflect Origin header (use array/regex in prod if you want to restrict)
   */
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
    exposedHeaders: ['Authorization'],
  });

  /**
   * API versioning (URI style: /v1/..., /v2/...)
   */
  app.enableVersioning({ type: VersioningType.URI });

  /**
   * Security headers
   */
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  /**
   * Global validation / serialization
   */
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => {
        // Log raw validation errors
        Logger.error('Validation failed', JSON.stringify(errors, null, 2));

        // Log what values were received
        errors.forEach((err) => {
          Logger.error(
            `Invalid field: ${err.property}, received: ${JSON.stringify(err.value)}`,
          );
        });

        return new BadRequestException(errors);
      },
    }),
  );

  app.useGlobalInterceptors(
    // Resolve promises inside DTOs before class-transformer runs
    new ResolvePromisesInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  /**
   * Swagger (disabled in production)
   */
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NestJS ACTA E-Commerce API')
      .setDescription(
        'API documentation for the ACTA E-Commerce application built with NestJS',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  /**
   * Graceful shutdown (Prisma)
   * - Closes Prisma connections cleanly when the app receives SIGINT/SIGTERM
   */
  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);

  // Optionally also enable Nest shutdown hooks (safe to keep)
  app.enableShutdownHooks();

  /**
   * Start server
   * - Bind on 0.0.0.0 for containerized deployments
   */
  const port = configService.getOrThrow<number>('app.port', { infer: true });
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen(port, host);
  // Optional: log the actual URL once started
  // const url = await app.getUrl();
  // console.log(`Server listening on ${url}`);
}

void bootstrap();
