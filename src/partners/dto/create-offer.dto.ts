import { IsString, IsNumber, IsOptional, Min, Max, IsDateString } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateOfferDto {
  @IsString()
  title: string

  @IsString()
  description: string

  @IsString()
  category: string

  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  discount: number

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  originalPrice: number

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  pointsRequired: number

  @IsString()
  @IsOptional()
  image?: string

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  maxRedemptions?: number

  @IsDateString()
  @IsOptional()
  validUntil?: string

  @IsString()
  @IsOptional()
  restrictions?: string
}
