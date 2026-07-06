import type { ApplianceType } from '../types'

/**
 * The appliance catalog. Top-zone appliances either drop into the countertop
 * (grills, sinks, burners) or sit on it (pizza oven). Base-zone appliances
 * slide into the frame body below the counter.
 */
export const APPLIANCES: ApplianceType[] = [
  // ---- Top zone: drop-in ----
  {
    id: 'grill-90',
    name: 'Pro Series Gas Grill 90',
    shortName: 'Gas Grill 90',
    brand: 'EmberWorks',
    zone: 'top',
    mount: 'dropin',
    minFrameWidth: 90,
    price: 2890,
    description: '4-burner drop-in grill, 90 cm. Cast stainless burners, dual-position rotisserie.',
    icon: '🔥',
  },
  {
    id: 'grill-80',
    name: 'Pro Series Gas Grill 80',
    shortName: 'Gas Grill 80',
    brand: 'EmberWorks',
    zone: 'top',
    mount: 'dropin',
    minFrameWidth: 80,
    price: 2390,
    description: '3-burner drop-in grill, 80 cm. Infrared rear burner and interior halogen lights.',
    icon: '🔥',
  },
  {
    id: 'santamaria-90',
    name: 'Santa Maria Grill 90',
    shortName: 'Santa Maria 90',
    brand: 'AsadoWorks',
    zone: 'top',
    mount: 'dropin',
    minFrameWidth: 90,
    price: 3480,
    description: 'Open Argentine-style grill — crank wheel raises the grate over live oak coals.',
    icon: '🥩',
  },
  {
    id: 'griddle-60',
    name: 'Teppanyaki Griddle 60',
    shortName: 'Griddle 60',
    brand: 'PlanchaCo',
    zone: 'top',
    mount: 'dropin',
    minFrameWidth: 60,
    price: 1490,
    description: 'Chrome-plated flat top, 60 cm. Twin independent heat zones for smash burgers.',
    icon: '🍳',
  },
  {
    id: 'burner-40',
    name: 'Twin Side Burner 40',
    shortName: 'Side Burner',
    brand: 'EmberWorks',
    zone: 'top',
    mount: 'dropin',
    minFrameWidth: 40,
    price: 640,
    description: 'Two sealed brass burners, 40 cm. For sauces, boils and the morning coffee pot.',
    icon: '🫕',
  },
  {
    id: 'sink-40',
    name: 'Outdoor Sink Station 40',
    shortName: 'Sink 40',
    brand: 'CascadePro',
    zone: 'top',
    mount: 'dropin',
    minFrameWidth: 40,
    price: 520,
    description: '304 stainless bowl with cold-water tap and cutting-board cover.',
    icon: '🚰',
  },
  {
    id: 'icebin-40',
    name: 'Drop-in Ice Bin 40',
    shortName: 'Ice Bin',
    brand: 'CascadePro',
    zone: 'top',
    mount: 'dropin',
    minFrameWidth: 40,
    price: 430,
    description: 'Insulated ice well with bottle rail and drain. Keeps drinks cold for 12 hours.',
    icon: '🧊',
  },
  // ---- Top zone: kamado smokers (need a lowered smoker table) ----
  {
    id: 'egg-xl',
    name: 'Big Green Egg XL',
    shortName: 'Green Egg XL',
    brand: 'Big Green Egg',
    zone: 'top',
    mount: 'kamado',
    minFrameWidth: 80,
    price: 1899,
    description: 'XL ceramic kamado — low-and-slow smoker, pizza oven and grill in one. Needs a lowered table.',
    icon: '🥚',
  },
  {
    id: 'primo-xl',
    name: 'Primo Oval XL 400',
    shortName: 'Primo XL',
    brand: 'Primo',
    zone: 'top',
    mount: 'kamado',
    minFrameWidth: 80,
    price: 1749,
    description: 'Oval ceramic kamado with split-zone firebox. Needs a lowered table.',
    icon: '🪨',
  },
  // ---- Top zone: on-counter (also placeable on a corner) ----
  {
    id: 'pizza-60',
    name: 'Countertop Pizza Oven 60',
    shortName: 'Pizza Oven',
    brand: 'FornoVulcano',
    zone: 'top',
    mount: 'oncounter',
    minFrameWidth: 60,
    price: 1190,
    description: 'Gas-fired stone deck oven. 500 °C in 15 minutes, neapolitan in 90 seconds.',
    icon: '🍕',
  },
  {
    id: 'gozney-dome',
    name: 'Gozney Dome',
    shortName: 'Gozney Dome',
    brand: 'Gozney',
    zone: 'top',
    mount: 'oncounter',
    minFrameWidth: 60,
    price: 1799,
    description: 'Dual-fuel dome oven — wood or gas. Rolling flame, 500 °C, steam injection.',
    icon: '🍕',
  },
  {
    id: 'taboon-90',
    name: 'Taboon Clay Oven',
    shortName: 'Taboon',
    brand: 'ClayFire',
    zone: 'top',
    mount: 'oncounter',
    minFrameWidth: 60,
    price: 1290,
    description: 'Domed clay taboon / tandoor for laffa, flatbreads, kebabs and slow roasts.',
    icon: '🫓',
  },
  // ---- Base zone: under-counter ----
  {
    id: 'fridge-60',
    name: 'Outdoor Fridge 60',
    shortName: 'Fridge 60',
    brand: 'FrostLine',
    zone: 'base',
    mount: 'undercounter',
    minFrameWidth: 60,
    price: 1290,
    description: 'Weatherproof 145 L under-counter fridge with lockable glass door.',
    icon: '🥶',
  },
  {
    id: 'kegerator-60',
    name: 'Kegerator 60',
    shortName: 'Kegerator',
    brand: 'FrostLine',
    zone: 'base',
    mount: 'undercounter',
    minFrameWidth: 60,
    price: 1690,
    description: 'Single-tap beer dispenser for 20 L kegs. Stainless tower and drip tray.',
    icon: '🍺',
  },
  {
    id: 'drawers-40',
    name: 'Triple Drawer Stack 40',
    shortName: 'Drawers ×3',
    brand: 'EmberWorks',
    zone: 'base',
    mount: 'undercounter',
    minFrameWidth: 40,
    price: 540,
    description: 'Three soft-close stainless drawers for tools, towels and spice tins.',
    icon: '🗄️',
  },
  {
    id: 'doors-60',
    name: 'Double Access Doors 60',
    shortName: 'Double Doors',
    brand: 'EmberWorks',
    zone: 'base',
    mount: 'undercounter',
    minFrameWidth: 60,
    price: 380,
    description: 'Brushed double doors hiding the gas bottle and everything you shoved in there.',
    icon: '🚪',
  },
  {
    id: 'door-40',
    name: 'Single Access Door 40',
    shortName: 'Single Door',
    brand: 'EmberWorks',
    zone: 'base',
    mount: 'undercounter',
    minFrameWidth: 40,
    price: 240,
    description: 'Reversible single door with magnetic latch and vented panel.',
    icon: '🚪',
  },
  {
    id: 'trash-40',
    name: 'Trash & Recycling Pull-out 40',
    shortName: 'Trash Pull-out',
    brand: 'EmberWorks',
    zone: 'base',
    mount: 'undercounter',
    minFrameWidth: 40,
    price: 410,
    description: 'Twin-bin pull-out on full-extension rails. Out of sight, out of smell.',
    icon: '🗑️',
  },
  {
    id: 'icemaker-60',
    name: 'Ice Maker 60',
    shortName: 'Ice Maker',
    brand: 'FrostLine',
    zone: 'base',
    mount: 'undercounter',
    minFrameWidth: 60,
    price: 1990,
    description: 'Produces 25 kg of clear ice per day. The cocktail station backbone.',
    icon: '❄️',
  },
  {
    id: 'woodstore-40',
    name: 'Firewood Storage 40',
    shortName: 'Wood Store',
    brand: 'FornoVulcano',
    zone: 'base',
    mount: 'undercounter',
    minFrameWidth: 40,
    price: 190,
    description: 'Open shelf module for split oak. Looks great, smells better.',
    icon: '🪵',
  },
]

export const applianceById = new Map(APPLIANCES.map((a) => [a.id, a]))

/** AI-sourced real products, registered per loaded design. */
const customById = new Map<string, ApplianceType>()

export function registerCustomAppliances(list: ApplianceType[] | undefined) {
  for (const t of list ?? []) customById.set(t.id, t)
}

export function getAppliance(typeId: string): ApplianceType {
  const t = applianceById.get(typeId) ?? customById.get(typeId)
  if (!t) throw new Error(`Unknown appliance type: ${typeId}`)
  return t
}

export function fitsFrame(type: ApplianceType, frameWidth: number): boolean {
  return frameWidth >= type.minFrameWidth
}

/** Counter-level ovens that can sit on a corner unit. */
export const CORNER_OVENS = APPLIANCES.filter((a) => a.mount === 'oncounter')

/** Compact catalog reference for AI prompts. */
export function catalogSummary(custom: ApplianceType[] = []): string {
  return [...APPLIANCES, ...custom]
    .map((a) => `${a.id} | ${a.name} | zone:${a.zone} mount:${a.mount} | min ${a.minFrameWidth}cm | $${a.price}`)
    .join('\n')
}
