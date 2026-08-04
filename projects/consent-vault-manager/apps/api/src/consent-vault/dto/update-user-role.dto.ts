import { IsIn } from "class-validator";

import type { Role } from "../../../../../mock-store/types";

const ROLE_VALUES: Role[] = ["admin", "dpo", "viewer"];

export class UpdateUserRoleDto {
  @IsIn(ROLE_VALUES)
  role!: Role;
}
