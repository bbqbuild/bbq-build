import type { FrameFinish, FrameWidth } from '../types'

export interface FrameSpec {
  width: FrameWidth
  name: string
  price: number
}

export const FRAME_SPECS: FrameSpec[] = [
  { width: 40, name: 'Frame 40', price: 290 },
  { width: 60, name: 'Frame 60', price: 360 },
  { width: 80, name: 'Frame 80', price: 440 },
  { width: 90, name: 'Frame 90', price: 480 },
]

export const frameSpecByWidth = new Map(FRAME_SPECS.map((f) => [f.width, f]))

export interface FinishSpec {
  id: FrameFinish
  name: string
  swatch: string
}

export const FINISHES: FinishSpec[] = [
  { id: 'graphite', name: 'Graphite Powder-coat', swatch: '#3b4046' },
  { id: 'steel', name: 'Brushed Stainless', swatch: '#aeb6bd' },
  { id: 'teak', name: 'Teak Slat', swatch: '#9a6b43' },
  { id: 'stone', name: 'Basalt Stone Clad', swatch: '#6d6a66' },
]

export interface CounterMaterial {
  id: string
  name: string
  color: string
  edge: string
  roughness: number
  /** surcharge per running metre of counter */
  pricePerM: number
}

export const COUNTER_MATERIALS: CounterMaterial[] = [
  { id: 'quartz-white', name: 'White Quartz', color: '#e8e4da', edge: '#cfc9bb', roughness: 0.4, pricePerM: 120 },
  { id: 'granite-black', name: 'Black Granite', color: '#2c2d31', edge: '#202126', roughness: 0.32, pricePerM: 150 },
  { id: 'granite-speckled', name: 'Speckled Granite', color: '#6d6a66', edge: '#565350', roughness: 0.45, pricePerM: 140 },
  { id: 'butcher-block', name: 'Butcher Block', color: '#b5813f', edge: '#8f6432', roughness: 0.7, pricePerM: 90 },
  { id: 'concrete', name: 'Polished Concrete', color: '#b7b4ac', edge: '#9c9990', roughness: 0.6, pricePerM: 70 },
  { id: 'marble', name: 'Carrara Marble', color: '#e9e7e2', edge: '#d3d0c9', roughness: 0.3, pricePerM: 180 },
]

export const counterMaterialById = new Map(COUNTER_MATERIALS.map((m) => [m.id, m]))

export function counterMaterial(id: string | undefined): CounterMaterial {
  return counterMaterialById.get(id ?? '') ?? COUNTER_MATERIALS[0]
}

export const GROUND_TYPES: { id: 'deck' | 'concrete' | 'pavers' | 'stone'; name: string; pricePerM: number }[] = [
  { id: 'deck', name: 'Hardwood Deck', pricePerM: 210 },
  { id: 'concrete', name: 'Polished Concrete', pricePerM: 160 },
  { id: 'pavers', name: 'Porcelain Pavers', pricePerM: 185 },
  { id: 'stone', name: 'Natural Stone', pricePerM: 240 },
]
