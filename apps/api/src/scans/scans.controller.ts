import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CreateScanDto, ScanParamsDto } from './scans.dto';
import { toScanResponse } from './scans.mapper';
import { ScansService } from './scans.service';

@Controller('scans')
export class ScansController {
  constructor(private readonly service: ScansService) {}

  @Post()
  async create(
    @Body() body: CreateScanDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { scan, cached } = await this.service.create(body.repoUrl);
    res.status(cached ? HttpStatus.OK : HttpStatus.ACCEPTED);
    return {
      ...toScanResponse(scan),
      cached,
      links: { self: `/api/scans/${scan.id}` },
    };
  }

  @Get(':id')
  async get(@Param() params: ScanParamsDto) {
    return toScanResponse(await this.service.get(params.id));
  }
}
