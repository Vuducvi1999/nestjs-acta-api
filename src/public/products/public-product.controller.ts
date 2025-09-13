import { Controller, Get, HttpStatus, Query, Param } from '@nestjs/common';
import { PublicProductService } from './public-product.service';
import {
  PaginatedPublicProductResponseDto,
  PublicProductItemResponseDto,
  PublicProductDetailDto,
} from './dto/public-product-response.dto';
import { PublicProductQueryDto } from './dto/public-product-query.dto';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Public Products')
@Public() // This decorator makes endpoints publicly accessible
@Controller('public/products')
export class PublicProductController {
  constructor(private readonly publicProductService: PublicProductService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách sản phẩm công khai',
    description:
      'Lấy danh sách sản phẩm công khai với khả năng lọc, sắp xếp và phân trang',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy danh sách sản phẩm thành công',
    type: PaginatedPublicProductResponseDto,
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Từ khóa tìm kiếm cho tên, mô tả hoặc mã sản phẩm',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Lọc theo ID danh mục',
  })
  @ApiQuery({
    name: 'businessId',
    required: false,
    description: 'Lọc theo ID doanh nghiệp',
  })
  @ApiQuery({
    name: 'minPrice',
    required: false,
    description: 'Giá tối thiểu',
  })
  @ApiQuery({
    name: 'maxPrice',
    required: false,
    description: 'Giá tối đa',
  })
  @ApiQuery({
    name: 'freeShipping',
    required: false,
    description: 'Lọc theo miễn phí vận chuyển',
  })
  @ApiQuery({
    name: 'stockStatus',
    required: false,
    description: 'Trạng thái tồn kho (in_stock, low_stock, out_of_stock)',
  })
  @ApiQuery({
    name: 'categoryGroup',
    required: false,
    description: 'Lọc theo nhóm danh mục (phân cách bằng dấu phẩy)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Số trang (mặc định: 1)',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Kích thước trang (mặc định: 12)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Trường sắp xếp (name, price, createdAt, rating)',
  })
  @ApiQuery({
    name: 'sortDir',
    required: false,
    description: 'Hướng sắp xếp (asc, desc)',
  })
  async findAll(
    @Query() query: PublicProductQueryDto,
  ): Promise<PaginatedPublicProductResponseDto> {
    return this.publicProductService.findAll(query);
  }

  @Get('featured')
  @ApiOperation({
    summary: 'Lấy sản phẩm nổi bật',
    description: 'Lấy danh sách sản phẩm nổi bật',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy sản phẩm nổi bật thành công',
    type: [PublicProductItemResponseDto],
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Số lượng sản phẩm (mặc định: 8)',
  })
  async getFeatured(
    @Query('limit') limit?: number,
  ): Promise<PublicProductItemResponseDto[]> {
    return this.publicProductService.getFeatured(limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Lấy chi tiết sản phẩm theo ID',
    description: 'Lấy thông tin chi tiết của một sản phẩm theo ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy chi tiết sản phẩm thành công',
    type: PublicProductDetailDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy sản phẩm',
  })
  @ApiParam({
    name: 'id',
    description: 'ID của sản phẩm',
  })
  async findById(@Param('id') id: string): Promise<PublicProductDetailDto> {
    return this.publicProductService.findById(id);
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Lấy chi tiết sản phẩm theo slug',
    description: 'Lấy thông tin chi tiết của một sản phẩm theo slug',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy chi tiết sản phẩm thành công',
    type: PublicProductDetailDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy sản phẩm',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug của sản phẩm',
  })
  async findBySlug(
    @Param('slug') slug: string,
  ): Promise<PublicProductDetailDto> {
    return this.publicProductService.findBySlug(slug);
  }
}
