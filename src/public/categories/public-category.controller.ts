import { Controller, Get, HttpStatus, Query, Param } from '@nestjs/common';
import { PublicCategoryService } from './public-category.service';
import {
  PaginatedPublicCategoryResponseDto,
  PublicCategoryItemDto,
  PublicCategoryDetailDto,
  PublicCategoryTreeDto,
} from './dto/public-category-response.dto';
import {
  PublicCategoryQueryDto,
  PublicRelatedCategoryDto,
  PublicCategorySuggestDto,
} from './dto/public-category-query.dto';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Public Categories')
@Public() // This decorator makes endpoints publicly accessible
@Controller('public/categories')
export class PublicCategoryController {
  constructor(private readonly publicCategoryService: PublicCategoryService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách danh mục công khai',
    description:
      'Lấy danh sách danh mục công khai với khả năng lọc, sắp xếp và phân trang',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy danh sách danh mục thành công',
    type: PaginatedPublicCategoryResponseDto,
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Từ khóa tìm kiếm cho tên, mô tả hoặc slug danh mục',
  })
  @ApiQuery({
    name: 'parentId',
    required: false,
    description: 'Lọc theo ID danh mục cha',
  })
  @ApiQuery({
    name: 'isRoot',
    required: false,
    description: 'Lọc danh mục gốc (true/false)',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    description: 'Lọc danh mục đang hoạt động (true/false)',
  })
  @ApiQuery({
    name: 'group',
    required: false,
    description: 'Lọc theo nhóm danh mục (a, b, c)',
  })
  @ApiQuery({
    name: 'stockStatus',
    required: false,
    description: 'Trạng thái tồn kho của sản phẩm trong danh mục',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Số trang (mặc định: 1)',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Kích thước trang (mặc định: 20)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Trường sắp xếp (name, createdAt, updatedAt, productCount)',
  })
  @ApiQuery({
    name: 'sortDir',
    required: false,
    description: 'Hướng sắp xếp (asc, desc)',
  })
  async findAll(
    @Query() query: PublicCategoryQueryDto,
  ): Promise<PaginatedPublicCategoryResponseDto> {
    return this.publicCategoryService.findAll(query);
  }

  @Get('tree')
  @ApiOperation({
    summary: 'Lấy cây danh mục',
    description: 'Lấy cây danh mục phân cấp cho menu và navigation',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy cây danh mục thành công',
    type: PublicCategoryTreeDto,
  })
  @ApiQuery({
    name: 'withCounts',
    required: false,
    description: 'Bao gồm số lượng sản phẩm và con (true/false)',
  })
  @ApiQuery({
    name: 'maxDepth',
    required: false,
    description: 'Độ sâu tối đa của cây (mặc định: 3)',
  })
  async getTree(
    @Query('withCounts') withCounts?: boolean,
    @Query('maxDepth') maxDepth?: number,
  ): Promise<PublicCategoryTreeDto> {
    return this.publicCategoryService.getTree(withCounts, maxDepth);
  }

  @Get('suggestions')
  @ApiOperation({
    summary: 'Lấy gợi ý danh mục',
    description: 'Lấy gợi ý danh mục cho tìm kiếm và autocomplete',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy gợi ý danh mục thành công',
    type: [PublicCategorySuggestDto],
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Từ khóa tìm kiếm',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Số lượng gợi ý (mặc định: 10)',
  })
  async getSuggestions(
    @Query('q') q?: string,
    @Query('limit') limit?: number,
  ): Promise<PublicCategorySuggestDto[]> {
    return this.publicCategoryService.getSuggestions(q, limit);
  }

  @Get('related/:id')
  @ApiOperation({
    summary: 'Lấy danh mục liên quan',
    description: 'Lấy danh mục liên quan đến danh mục hiện tại',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy danh mục liên quan thành công',
    type: [PublicRelatedCategoryDto],
  })
  @ApiParam({
    name: 'id',
    description: 'ID của danh mục',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Số lượng danh mục liên quan (mặc định: 6)',
  })
  async getRelated(
    @Param('id') id: string,
    @Query('limit') limit?: number,
  ): Promise<PublicRelatedCategoryDto[]> {
    return this.publicCategoryService.getRelated(id, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Lấy chi tiết danh mục theo ID',
    description: 'Lấy thông tin chi tiết của một danh mục theo ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy chi tiết danh mục thành công',
    type: PublicCategoryDetailDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy danh mục',
  })
  @ApiParam({
    name: 'id',
    description: 'ID của danh mục',
  })
  @ApiQuery({
    name: 'includeFeatured',
    required: false,
    description: 'Bao gồm sản phẩm nổi bật (true/false)',
  })
  async findById(
    @Param('id') id: string,
    @Query('includeFeatured') includeFeatured?: boolean,
  ): Promise<PublicCategoryDetailDto> {
    return this.publicCategoryService.findById(id, includeFeatured);
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Lấy chi tiết danh mục theo slug',
    description: 'Lấy thông tin chi tiết của một danh mục theo slug',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy chi tiết danh mục thành công',
    type: PublicCategoryDetailDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy danh mục',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug của danh mục',
  })
  @ApiQuery({
    name: 'includeFeatured',
    required: false,
    description: 'Bao gồm sản phẩm nổi bật (true/false)',
  })
  async findBySlug(
    @Param('slug') slug: string,
    @Query('includeFeatured') includeFeatured?: boolean,
  ): Promise<PublicCategoryDetailDto> {
    return this.publicCategoryService.findBySlug(slug, includeFeatured);
  }
}
