import { Controller, Get, HttpStatus, Query, Param } from '@nestjs/common';
import { PublicBusinessService } from './public-businesses.service';
import {
  PaginatedPublicBusinessResponseDto,
  PublicBusinessItemResponseDto,
  PublicBusinessDetailDto,
} from './dto/public-business-response.dto';
import { PublicBusinessQueryDto } from './dto/public-business-query.dto';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Public Businesses')
@Public() // This decorator makes endpoints publicly accessible
@Controller('public/businesses')
export class PublicBusinessController {
  constructor(private readonly publicBusinessService: PublicBusinessService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách doanh nghiệp công khai',
    description:
      'Lấy danh sách doanh nghiệp công khai với khả năng lọc, sắp xếp và phân trang',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy danh sách doanh nghiệp thành công',
    type: PaginatedPublicBusinessResponseDto,
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Từ khóa tìm kiếm cho tên, mô tả hoặc chuyên môn',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Lọc theo ID danh mục sản phẩm',
  })
  @ApiQuery({
    name: 'specialty',
    required: false,
    description: 'Lọc theo chuyên môn (phân cách bằng dấu phẩy)',
  })
  @ApiQuery({
    name: 'verified',
    required: false,
    description: 'Lọc theo trạng thái xác thực',
  })
  @ApiQuery({
    name: 'minRating',
    required: false,
    description: 'Đánh giá tối thiểu (0-5)',
  })
  @ApiQuery({
    name: 'maxDeliverySlaMinutes',
    required: false,
    description: 'Thời gian giao hàng tối đa (phút)',
  })
  @ApiQuery({
    name: 'minProductCount',
    required: false,
    description: 'Số lượng sản phẩm tối thiểu',
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
    description:
      'Trường sắp xếp (name, rating, productCount, growthRate, createdAt)',
  })
  @ApiQuery({
    name: 'sortDir',
    required: false,
    description: 'Hướng sắp xếp (asc, desc)',
  })
  async findAll(
    @Query() query: PublicBusinessQueryDto,
  ): Promise<PaginatedPublicBusinessResponseDto> {
    return this.publicBusinessService.findAll(query);
  }

  @Get('featured')
  @ApiOperation({
    summary: 'Lấy doanh nghiệp nổi bật',
    description: 'Lấy danh sách doanh nghiệp nổi bật',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy doanh nghiệp nổi bật thành công',
    type: [PublicBusinessItemResponseDto],
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Số lượng doanh nghiệp (mặc định: 8)',
  })
  async getFeatured(
    @Query('limit') limit?: number,
  ): Promise<PublicBusinessItemResponseDto[]> {
    return this.publicBusinessService.getFeatured(limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Lấy chi tiết doanh nghiệp theo ID',
    description: 'Lấy thông tin chi tiết của một doanh nghiệp theo ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy chi tiết doanh nghiệp thành công',
    type: PublicBusinessDetailDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy doanh nghiệp',
  })
  @ApiParam({
    name: 'id',
    description: 'ID của doanh nghiệp',
  })
  async findById(@Param('id') id: string): Promise<PublicBusinessDetailDto> {
    return this.publicBusinessService.findById(id);
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Lấy chi tiết doanh nghiệp theo slug',
    description: 'Lấy thông tin chi tiết của một doanh nghiệp theo slug',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy chi tiết doanh nghiệp thành công',
    type: PublicBusinessDetailDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy doanh nghiệp',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug của doanh nghiệp',
  })
  async findBySlug(
    @Param('slug') slug: string,
  ): Promise<PublicBusinessDetailDto> {
    return this.publicBusinessService.findBySlug(slug);
  }
}
