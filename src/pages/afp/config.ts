/**
 * How the club uses the AFP. These are club wide switches (like the club data), not personal settings. With `enabled` off the club does the
 * preparation on paper and the system shows no AFP anywhere.
 */
export interface AfpConfig {
  enabled: boolean
  /** The pilot confirms the pre-flight check and signs; a PDF is made as evidence. */
  evidence: boolean
  /** The PDF goes to the pilot by mail when the AFP is released. */
  mailPdf: boolean
  /** Final reserve in minutes. */
  reserveMin: number
}
export const DEFAULT_AFP_CONFIG: AfpConfig = { enabled: true, evidence: true, mailPdf: true, reserveMin: 30 }
