// src/otp/otp.controller.ts

import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OtpService } from './otp.service';

@Controller('otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('/generate')
  async generateOtp(
    @Body() body: { userId: string; purpose: string },
  ): Promise<{ otp: string }> {
    const otp = await this.otpService.generateOtp(body.userId, body.purpose);
    return { otp };
  }

  @Get('/validate')
  async validateOtp(
    @Query('userId') userId: string,
    @Query('purpose') purpose: string,
    @Query('otp') otp: string,
  ): Promise<{ isValid: boolean }> {
    const isValid = await this.otpService.validateOtp(userId, purpose, otp);
    return { isValid };
  }

  @Delete('/delete-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAllOtps(): Promise<void> {
    await this.otpService.deleteAllOtps();
  }
}
