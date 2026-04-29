import { IsEmail, IsString, MinLength, IsOptional, Matches } from 'class-validator'

export class RegisterPartnerDto {
  @IsString()
  name: string

  @IsEmail()
  email: string

  @IsString()
  @MinLength(8)
  password: string

  @IsString()
  @Matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, { message: 'CNPJ inválido. Use o formato 00.000.000/0000-00' })
  cnpj: string

  @IsString()
  category: string

  @IsString()
  @IsOptional()
  phone?: string

  @IsString()
  @IsOptional()
  website?: string

  @IsString()
  @IsOptional()
  description?: string
}
