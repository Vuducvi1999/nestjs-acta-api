import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Prisma, Role } from '@prisma/client';
import { messages } from '../constants/messages';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../common/services/prisma.service';
import { CurrentUser } from '../users/users.decorator';
import { AuthUser } from './auth-user';
import { AuthService } from './auth.service';
import { ChangeEmailDto } from './dto/change-email.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/auth-response.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationEmailDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtPayload } from './jwt-payload';
import { UserProfileResponseDto } from '../users/dto/user-profile-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly phoneNumberRegex = /^[0-9]{10,15}$/;
  private readonly emailRegex =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 attempts per minute
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User successfully registered',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email or username already exists',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Too many registration attempts, please try again later',
  })
  async register(@Body() registerDto: RegisterDto): Promise<string> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Login response - always returns 200 with success/error structure',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Too many login attempts, please try again later',
  })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'New tokens generated successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid refresh token',
  })
  async refreshTokens(
    @Body() dto: { refreshToken: string; username: string },
  ): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    return this.authService.refreshTokens(dto.refreshToken, dto.username);
  }

  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Email successfully verified',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invalid or expired token',
  })
  async verifyEmail(@Query('token') token: string) {
    await this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Verification email sent',
  })
  async resendVerificationEmail(
    @Body() resendVerificationEmailDto: ResendVerificationEmailDto,
  ) {
    await this.authService.resendVerificationEmail(
      resendVerificationEmailDto.email,
    );
  }

  @Post('request-password-change-otp')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request password change OTP' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'OTP sent to user email if current password is correct',
  })
  async requestPasswordChangeOtp(
    @CurrentUser() user: AuthUser,
    @Body('currentPassword') currentPassword: string,
  ) {
    await this.authService.requestPasswordChangeOtp(user.id, currentPassword);
    return { message: 'OTP has been sent to your email' };
  }

  @Post('confirm-password-change')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm OTP and change password' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password successfully changed',
  })
  async confirmPasswordChange(
    @CurrentUser() user: AuthUser,
    @Body() body: { otp: string; newPassword: string },
  ) {
    await this.authService.confirmPasswordChange(
      user.id,
      body.otp,
      body.newPassword,
    );
    return { message: 'Password has been changed successfully' };
  }

  @Post('change-email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request email change' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Email change requested',
  })
  async requestEmailChange(
    @CurrentUser() user: AuthUser,
    @Body() changeEmailDto: ChangeEmailDto,
  ) {
    await this.authService.requestEmailChange(user.id, changeEmailDto.newEmail);
  }

  @Get('confirm-email-change')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm email change' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Email successfully changed',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invalid or expired token',
  })
  async confirmEmailChange(@Query('token') token: string) {
    await this.authService.confirmEmailChange(token);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Public()
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 attempts per 5 minutes
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset email sent',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Too many password reset requests, please try again later',
  })
  async requestPasswordReset(@Body('email') email: string) {
    return await this.authService.requestPasswordReset(email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOperation({ summary: 'Reset password using token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password successfully reset',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invalid or expired token',
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    await this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.password,
    );
  }

  @Get('current-user')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getCurrentUser(@CurrentUser() user: JwtPayload) {
    let whereClause: Prisma.UserWhereInput;

    if (this.phoneNumberRegex.test(user.phoneNumber)) {
      whereClause = { phoneNumber: user.phoneNumber };
    } else if (this.emailRegex.test(user.email)) {
      whereClause = { email: user.email };
    } else {
      const lowerCaseUsername = user.referenceId.toLowerCase();
      whereClause = { referenceId: lowerCaseUsername };
    }

    const existUser = await this.prisma.user.findFirst({
      where: whereClause,
      select: {
        avatar: {
          select: {
            fileUrl: true,
          },
        },
        cover: {
          select: {
            fileUrl: true,
          },
        },
        fullName: true,
        dob: true,
        gender: true,
        country: true,
        bio: true,
        website: true,
        verificationDate: true,
        isActive: true,
        status: true,
        rejectedReason: true,
        role: true,
        userConfig: {
          select: {
            config: true,
          },
        },
        // Add referrer information
        referrer: {
          select: {
            id: true,
            fullName: true,
            referenceId: true,
            avatar: {
              select: {
                fileUrl: true,
              },
            },
          },
        },
        // Add addresses information
        addresses: {
          select: {
            id: true,
            name: true,
            type: true,
            fullName: true,
            phone: true,
            street: true,
            ward: true,
            district: true,
            city: true,
            state: true,
            country: true,
            postalCode: true,
            placeId: true,
            latitude: true,
            longitude: true,
            formattedAddress: true,
            isDefault: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
        _count: {
          select: {
            referrals: true,
            posts: {
              where: {
                isPublished: true,
                publishedAt: {
                  not: null,
                },
                deletedAt: null,
              },
            },
            followers: {
              where: {
                deletedAt: null,
              },
            },
            following: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    if (!existUser) {
      throw new UnauthorizedException(messages.invalidCredentials);
    }

    if (!existUser.referrer && existUser.role !== Role.admin) {
      throw new UnauthorizedException(messages.userNotReferrer);
    }

    const userMapping = UserProfileResponseDto.fromUserEntity(existUser);

    return userMapping;
  }
}
