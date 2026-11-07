import { HttpException } from '@nestjs/common';

export class ApiError extends HttpException {
  constructor(type: string, title: string, status: number, detail: string) {
    super({ type, title, status, detail }, status);
  }
}
