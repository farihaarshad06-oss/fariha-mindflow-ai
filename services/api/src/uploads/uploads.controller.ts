import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators';
import { UploadsService } from './uploads.service';
import { UploadRequestDto } from './uploads.dto';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('request')
  request(@Body() dto: UploadRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.uploadsService.requestUpload(user.userId, dto);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.uploadsService.completeUpload(id, user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.uploadsService.deleteUpload(id, user.userId);
  }
}
