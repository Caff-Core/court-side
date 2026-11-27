import { Global, Module } from "@nestjs/common"

/** Injection token for the current time. Tests swap in a FixedClock. */
export const CLOCK = Symbol("CLOCK")

export interface Clock {
  now(): Date
}

export const systemClock: Clock = { now: () => new Date() }

/** A clock that stays at one instant until moved, for deadline checks. */
export class FixedClock implements Clock {
  private current: Date

  constructor(iso: string) {
    this.current = new Date(iso)
  }

  set(iso: string) {
    this.current = new Date(iso)
  }

  now() {
    return new Date(this.current)
  }
}

@Global()
@Module({
  providers: [{ provide: CLOCK, useValue: systemClock }],
  exports: [CLOCK],
})
export class ClockModule {}
