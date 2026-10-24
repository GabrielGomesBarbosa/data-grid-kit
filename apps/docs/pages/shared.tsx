import type { ComponentType, ReactNode } from 'react'
import { Demo } from '../components/Demo'

export interface PageDef {
  id: string
  group: 'Getting started' | 'Demos' | 'Main features' | 'Advanced features' | 'Guides' | 'Reference'
  title: string
  intro: string
  body: () => ReactNode
}

export const demo = (name: string, Component: ComponentType, source: string) => (
  <Demo name={name} Component={Component} source={source} />
)

export const Status = ({ s }: { s: 'done' | 'planned' }) => (
  <span className={`pill ${s}`}>{s === 'done' ? 'Available' : 'Planned'}</span>
)
