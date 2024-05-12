// src/otp/otp.service.ts

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Otp, OtpDocument } from './otp.schema';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OtpService {
  constructor(
    @InjectModel(Otp.name) private otpModel: Model<OtpDocument>,
    @InjectRedis() private readonly redisClient: Redis,
    private configService: ConfigService,
  ) {}

  async generateOtp(userId: string, purpose: string): Promise<string> {
    try {
      const otpValidity =
        +this.configService.get<number>('OTP_VALIDITY') || 300; // 5 minutes in seconds;

      // Check Redis first for an existing OTP
      const cacheKey = `otp:${userId}:${purpose}`;
      let otp = await this.redisClient.get(cacheKey);

      if (otp) {
        return otp; // Return the cached OTP if it exists
      }

      // If no OTP in cache, check MongoDB and verify if it's still valid
      const existingOtp = await this.otpModel
        .findOne({ userId, purpose })
        .sort({ createdAt: -1 });
      if (
        existingOtp &&
        Date.now() - existingOtp.createdAt.getTime() < otpValidity
      ) {
        otp = existingOtp.otp;
        // Refresh the cache
        await this.redisClient.set(cacheKey, otp, 'EX', otpValidity);
        return otp;
      }

      // Generate a new OTP if none are valid
      otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

      // Save to Redis and MongoDB
      await this.redisClient.set(cacheKey, otp, 'EX', otpValidity);
      const newOtp = new this.otpModel({ userId, otp, purpose });
      await newOtp.save();

      return otp;
    } catch (err) {
      console.error('Failed to generate OTP:', err);
      throw new Error('Internal server error');
    }
  }

  async validateOtp(
    userId: string,
    purpose: string,
    otp: string,
  ): Promise<boolean> {
    const cacheKey = `otp:${userId}:${purpose}`;
    const cachedOtp = await this.redisClient.get(cacheKey);
    return cachedOtp === otp;
  }
  async invalidateOtps(
    userId: string,
    purpose?: string,
  ): Promise<{ deletedCount: number }> {
    let result;
    if (purpose) {
      // Invalidate a specific OTP for a given purpose
      result = await this.otpModel.deleteMany({ userId, purpose });
      await this.redisClient.del(`otp:${userId}:${purpose}`);
    } else {
      // Invalidate all OTPs for the user
      result = await this.otpModel.deleteMany({ userId });
      // Assuming all keys are well known and follow the `otp:{userId}:{purpose}` pattern
      const keys = await this.redisClient.keys(`otp:${userId}:*`);
      await Promise.all(keys.map((key) => this.redisClient.del(key)));
    }
    return { deletedCount: result.deletedCount };
  }

  async deleteAllOtps(): Promise<{ deletedCount: number }> {
    const result = await this.otpModel.deleteMany({});
    await this.redisClient.flushall();
    return { deletedCount: result.deletedCount };
  }
}
