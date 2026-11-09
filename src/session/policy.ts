/** All session limits live here and nowhere else (V1: lib/session/policy.ts). Minutes. */
export const SESSION_POLICY = {
  /** Trusted devices stay signed in until the user signs out. */
  untrustedIdleMin: 30,
  untrustedAbsoluteMin: 180,
  /** The warning dialog appears this long before the idle end. */
  warnBeforeMin: 5,
} as const

export const STEP_UP_POLICY = {
  /** After a confirmation, sensitive actions work for this long on an untrusted device. */
  elevatedMin: 15,
  maxWrongPasswords: 5,
  lockMin: 5,
} as const

/** The demo password for every account. */
export const DEMO_PASSWORD = 'demo'
