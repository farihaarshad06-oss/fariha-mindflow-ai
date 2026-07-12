import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './auth.dto';
import type { Request as ExpressRequest } from 'express';

interface RequestWithId extends ExpressRequest {
  requestId?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: RequestWithId) {
    return this.authService.register(dto, req.requestId);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: RequestWithId) {
    return this.authService.login(dto, req.requestId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: AuthenticatedUser, @Req() req: RequestWithId) {
    return this.authService.logout(user.userId, req.requestId);
  }

  @Public()
  @Get('providers')
  providers() {
    return { google: false, apple: false, message: 'External providers are planned.' };
  }
}
