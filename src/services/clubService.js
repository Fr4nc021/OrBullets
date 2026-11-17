/**
 * Estoque e produção do clube — API local ou Supabase (`orbullets_club_*`).
 */
import * as apiClubRepo from './repositories/apiClubRepository.js'
import * as supabaseClubRepo from './repositories/supabaseClubRepository.js'
import { isDesktopLocalApi } from './dataMode.js'

function clubRepo() {
  return isDesktopLocalApi() ? apiClubRepo : supabaseClubRepo
}

export async function fetchClubCalibers() {
  return clubRepo().fetchClubCalibers()
}

export async function createClubCaliber(name) {
  return clubRepo().createClubCaliber(name)
}

export async function fetchClubItems(kind) {
  return clubRepo().fetchClubItems(kind)
}

export async function createClubItem(name, kind) {
  return clubRepo().createClubItem(name, kind)
}

/** @param {{ name?: string, kind?: string }} body */
export async function updateClubItem(id, body) {
  return clubRepo().updateClubItem(id, body)
}

export async function setClubItemBalance(id, quantity) {
  return clubRepo().setClubItemBalance(id, quantity)
}

export async function deleteClubItem(id) {
  return clubRepo().deleteClubItem(id)
}

export async function clearClubItemMovements(id) {
  return clubRepo().clearClubItemMovements(id)
}

export async function updateClubCaliber(id, name) {
  return clubRepo().updateClubCaliber(id, name)
}

export async function deleteClubCaliber(id) {
  return clubRepo().deleteClubCaliber(id)
}

export async function fetchClubStock() {
  return clubRepo().fetchClubStock()
}

export async function createClubStockMovement(body) {
  return clubRepo().createClubStockMovement(body)
}

export async function fetchClubStockMovements(limit = 200) {
  return clubRepo().fetchClubStockMovements(limit)
}

export async function updateClubStockMovement(id, body) {
  return clubRepo().updateClubStockMovement(id, body)
}

export async function deleteClubStockMovement(id) {
  return clubRepo().deleteClubStockMovement(id)
}

export async function fetchClubRecipes() {
  return clubRepo().fetchClubRecipes()
}

export async function fetchClubRecipe(caliberId) {
  return clubRepo().fetchClubRecipe(caliberId)
}

export async function deleteClubRecipe(caliberId) {
  return clubRepo().deleteClubRecipe(caliberId)
}

export async function saveClubRecipe(caliberId, body) {
  return clubRepo().saveClubRecipe(caliberId, body)
}

export async function postClubProduction(body) {
  return clubRepo().postClubProduction(body)
}

export async function fetchClubProductionBatches(limit = 50) {
  return clubRepo().fetchClubProductionBatches(limit)
}

export async function updateClubProductionBatch(id, body) {
  return clubRepo().updateClubProductionBatch(id, body)
}

export async function deleteClubProductionBatch(id) {
  return clubRepo().deleteClubProductionBatch(id)
}

export async function fetchClubReportSummary(from, to) {
  return clubRepo().fetchClubReportSummary(from, to)
}