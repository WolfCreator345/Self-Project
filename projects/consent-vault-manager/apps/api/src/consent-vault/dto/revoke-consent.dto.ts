import { IsString } from "class-validator";

export class RevokeConsentDto {
  @IsString()
  reason!: string;
}
