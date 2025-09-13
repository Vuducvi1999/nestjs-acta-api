import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { AttachmentModule } from '../../attachments/attachment.module';
import { CloudinaryModule } from '../../cloudinary/cloudinary.module';
import { FileUploadModule } from '../../file-upload/file-upload.module';
import { FileUploadService } from '../../file-upload/file-upload.service';
import { ProductsController } from './products.controller';
import { ProductService } from './products.service';

@Module({
  imports: [CloudinaryModule, FileUploadModule, AttachmentModule],
  providers: [PrismaService, FileUploadService, ProductService],
  exports: [PrismaService, ProductService],
  controllers: [ProductsController],
})
export class ProductsModule {}
