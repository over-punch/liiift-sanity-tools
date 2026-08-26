/**
 * Server entry point — Node only.
 *
 * Nothing here may be imported from the Studio entry (`src/index.ts`). This module reaches
 * node:crypto and reads service-account credentials from the environment; keeping it behind its
 * own export subpath is what guarantees a bundler cannot pull it into a Studio browser bundle.
 */

export { createVisitorInsightsHandler, ENV_VARS, type HandlerOptions } from './server/createHandler'
export type { HandlerRequest, HandlerResponse, StudioUser } from './server/auth'
export { verifyStudioRequest, requireStudioUser, applyCors } from './server/auth'
export type { SanityQueryClient } from './server/orders'
export { clearCache } from './server/cache'

// Report result shapes, so a consuming site can type a custom surface against them.
export type { MeasurementHealthData } from './server/reports/measurementHealth'
export type { AcquisitionData, SourceRow } from './server/reports/acquisition'
export type { JourneyData, JourneyStep, ExitPage } from './server/reports/journey'
export type { TypefaceInterestData, TypefaceInterestRow } from './server/reports/typefaceInterest'
export { JOURNEY_STEPS } from './server/reports/journey'
export { DESIGN_INDUSTRY_SOURCES } from './server/reports/acquisition'

// Shared contract, re-exported so the server entry is self-sufficient.
export * from './types'
export * from './core/cutover'
export * from './core/siteConfig'
export * from './core/ranges'
