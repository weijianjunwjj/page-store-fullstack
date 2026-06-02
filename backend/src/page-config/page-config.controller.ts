import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PageConfigService } from './page-config.service';
import { QueryPageConfigDto } from './dto/query-page-config.dto';
import { CreatePageConfigDto } from './dto/create-page-config.dto';
import { UpdatePageConfigDto } from './dto/update-page-config.dto';

@ApiTags('page-config')
@Controller('page-config')
export class PageConfigController {
  constructor(private readonly service: PageConfigService) {}

  @Get()
  list(@Query() query: QueryPageConfigDto) {
    return null;
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return null;
  }

  @Post()
  create(@Body() dto: CreatePageConfigDto) {
    return null;
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePageConfigDto) {
    return null;
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return null;
  }
}