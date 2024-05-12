import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return (
      'Server is working! version : ' + process.env.npm_package_version + ' '
    );
  }
}
