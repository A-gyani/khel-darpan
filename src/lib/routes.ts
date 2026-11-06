import type { Role } from './types'
export const home = (r: Role) => (r === 'district_officer' ? '/dso' : r === 'state_officer' ? '/state' : '/map')
