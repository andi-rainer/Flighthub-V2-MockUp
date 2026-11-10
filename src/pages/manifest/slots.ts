import type { Jumper } from '../../data'

/** Places a person takes on a load: a tandem pair takes 2. */
export const slots = (js: Jumper[]) => js.reduce((n, j) => n + (j.kind === 'tandem' ? 2 : 1), 0)
