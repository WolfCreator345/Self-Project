import { IsString } from "class-validator";

export class CreateConsentArtifactDto {
  @IsString()
  principalId!: string;

  @IsString()
  purposeId!: string;

  @IsString()
  noticeVersion!: string;

  @IsString()
  language!: string;
}
