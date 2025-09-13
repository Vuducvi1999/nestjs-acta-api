import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { AddressModule } from './address/address.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { ExternalAppGuard } from './common/guards/external-app.guard';
import { CategoriesModule } from './categories/categories.module';
import databaseConfig from './common/configs/database.config';
import appConfig from './common/configs/index.config';
import muxConfig from './common/configs/mux.config';
import redisConfig from './common/configs/redis.config';
import resendConfig from './common/configs/resend.config';
import { RolesGuard } from './common/guards/roles.guard';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard';
import { CacheConfigService } from './common/services/cache-config.service';

import { DocumentModule } from './documents/document.module';
import { FileUploadModule } from './file-upload/file-upload.module';
import { HomeModule } from './home/home.module';
import { MailModule } from './mail/mail.module';
import { NewsModule } from './news/news.module';
import { NotificationModule } from './notifications/notification.module';
import { PostModule } from './posts/posts.module';
import { StatisticsModule } from './statistics/statistics.module';
import { BusinessModule } from './business/business.module';
import { UserModule } from './users/users.module';
import { SentryModule } from '@sentry/nestjs/setup';
import { MessagesModule } from './messages/messages.module';
import { AffiliateModule } from './affiliate/affiliate.module';
import { KiotVietModule } from './integrations/kiotviet/kiotviet.module';
import kiotvietConfig from './common/configs/kiotviet.config';
import { PublicProductModule } from './public/products/public-product.module';
import { PublicBusinessModule } from './public/businesses/public-businesses.module';

import paymentConfig from './common/configs/payment.config';
import { ProductsModule } from './e-commerce/products/products.module';
import { CheckoutModule } from './e-commerce/checkout/checkout.module';
import { PublicCartModule } from './public/carts/public-cart.module';
import { PaymentsModule } from './e-commerce/payments/payments.module';
import { EcommerceAnalyticsModule } from './e-commerce/analytics/analytics.module';
import { AppController } from './app.controller';
import { PublicCategoryModule } from './public/categories/public-category.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'public'),
      serveRoot: '/static/',
    }),
    CacheConfigService.register(),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        resendConfig,
        muxConfig,
        redisConfig,
        kiotvietConfig,
        paymentConfig,
      ],
      envFilePath: ['.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 50,
      },
    ]),
    HomeModule,
    UserModule,
    AuthModule,
    AddressModule,
    AnalyticsModule,
    PostModule,
    MailModule,
    FileUploadModule,
    NewsModule,
    DocumentModule,
    ProductsModule,
    CheckoutModule,
    PaymentsModule,
    EcommerceAnalyticsModule,
    StatisticsModule,
    BusinessModule,
    CategoriesModule,
    NotificationModule,
    MessagesModule,
    AffiliateModule,
    KiotVietModule,
    PublicProductModule,
    PublicBusinessModule,
    PublicCategoryModule,
    PublicCartModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ExternalAppGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
