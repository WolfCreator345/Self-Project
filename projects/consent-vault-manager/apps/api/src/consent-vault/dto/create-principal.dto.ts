import { IsBoolean, IsEmail, IsOptional, IsString } from "class-validator";

export class CreatePrincipalDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsBoolean()
  isMinor!: boolean;

  @IsOptional()
  @IsString()
  guardianName?: string;

  @IsOptional()
  @IsEmail()
  guardianEmail?: string;
}
