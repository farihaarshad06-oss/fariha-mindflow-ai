import { Controller, Post, Body, Get, Param, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators';
import { AuthService } from './auth.service';
import { RegisterDto } from './auth.dto';
import { LoginDto } from './auth.dto';
import { LogoutDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: any) {
    return this.authService.register(dto, req.headers['x-request-id']);
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: any) {
    return this.authService.login(dto, req.headers['x-request-id']);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    return this.authService.logout(user.userId, req.headers['x-request-id']);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    // In a real implementation, this would invalidate all refresh tokens for this user
    // For now, we'll just log the action
    return { success: true };
  }

  @Post('refresh')
  async refresh(@Req() req: any) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }
    
    try {
      const payload = this.authService.jwt.verifyRefresh(token);
      const user = await this.authService.me(payload.sub);
      return this.authService.issueTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

export class RegisterDto {
  email: string;
  password: string;
  fullName: string;
  role?: Role;
}

export class LoginDto {
  email: string;
  password: string;
}

export class LogoutDto {
  // Empty for now
}