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

export const GROUND_TYPES: { id: 'deck' | 'concrete' | 'pavers' | 'stone'; name: string; pricePerM: number }[] = [
  { id: 'deck', name: 'Hardwood Deck', pricePerM: 210 },
  { id: 'concrete', name: 'Polished Concrete', pricePerM: 160 },
  { id: 'pavers', name: 'Porcelain Pavers', pricePerM: 185 },
  { id: 'stone', name: 'Natural Stone', pricePerM: 240 },
]
