import { IsString, IsIn, IsInt, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePageConfigDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ enum: ['active', 'archived'] })
  @IsIn(['active', 'archived'])
  status!: string;

  @ApiProperty({ description: 'JSON 字符串' })
  @IsString()
  configJson!: string;

  @ApiProperty({ description: 'W5 接 JWT 后从 token 取,本周先手传' })
  @IsInt()
  userId!: number;
}