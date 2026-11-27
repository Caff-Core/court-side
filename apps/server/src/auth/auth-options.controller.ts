import { Controller, Get, Inject } from "@nestjs/common"

import { ENV } from "../config/config.module.js"
import { googleCredentials, type Env } from "../config/env.js"
import { Public } from "./access.decorators.js"
import { FIXTURE_PERSONAS } from "./fixture-personas.js"

/** Tells the sign-in screen which sign-in methods this deployment offers. */
@Controller("auth-options")
export class AuthOptionsController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  @Public()
  @Get()
  options() {
    return {
      google: googleCredentials(this.env) !== null,
      identityFixture: this.env.AUTH_IDENTITY_FIXTURE
        ? { personas: FIXTURE_PERSONAS }
        : null,
    }
  }
}
