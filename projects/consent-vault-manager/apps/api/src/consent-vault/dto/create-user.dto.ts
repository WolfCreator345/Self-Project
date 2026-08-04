import { IsIn, IsString, MinLength } from "class-validator";

import type { Role } from "../../../../../mock-store/types";

const ROLE_VALUES: Role[] = ["admin", "dpo", "viewer"];

export class CreateUserDto {
  @IsString()
  username!: string;

  /** Plaintext — hashed with bcrypt in UsersController before it ever reaches UserRepository. */
  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(ROLE_VALUES)
  role!: Role;
}
