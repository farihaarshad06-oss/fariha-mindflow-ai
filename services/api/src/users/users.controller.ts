import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('PLATFORM_ADMIN')
  @Get()
  list() {
    return this.usersService.list();
  }

  @Roles('PLATFORM_ADMIN')
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.usersService.getById(id);
  }

  @Roles('PLATFORM_ADMIN')
  @Post(':id/disable')
  disable(@Param('id') id: string) {
    return this.usersService.disable(id);
  }
}
