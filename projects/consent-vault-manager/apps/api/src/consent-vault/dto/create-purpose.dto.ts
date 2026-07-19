import { IsIn, IsInt, IsString, Min } from "class-validator";

import type { LawfulBasis } from "../../../../../mock-store/types";

const LAWFUL_BASIS_VALUES: LawfulBasis[] = ["consent", "legitimate_use"];

export class CreatePurposeDto {
  @IsString()
  description!: string;

  @IsIn(LAWFUL_BASIS_VALUES)
  lawfulBasis!: LawfulBasis;

  @IsInt()
  @Min(1)
  retentionPeriodDays!: number;
}
