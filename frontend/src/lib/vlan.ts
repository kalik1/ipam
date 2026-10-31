export const VLAN_CABLE_COLORS = [
  '#3D7EF0',
  '#E9C23B',
  '#2FB874',
  '#E04A4F',
  '#EE8A2E',
  '#9468EE',
  '#E5679F',
  '#DCE1E6',
] as const

export const NO_VLAN_COLOR = '#7A8591'

export function vlanColor(tag: number | null | undefined): string {
  if (tag === null || tag === undefined) return NO_VLAN_COLOR
  return VLAN_CABLE_COLORS[tag % VLAN_CABLE_COLORS.length]
}
