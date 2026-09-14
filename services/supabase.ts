/**
 * Sostituzione motore dati: Transizione da Supabase a MySQL Aruba Business
 * Questo file re-indirizza tutte le richieste al nuovo client MySQL su hosting Aruba
 * garantendo piena continuità e compatibilità retroattiva.
 */

import { arubaClient } from './arubaDbClient';

export const supabase = arubaClient;
export const arubaDbClient = arubaClient;

export const supabaseUrl = process.env.ARUBA_BRIDGE_URL || 'https://www.tuodominioaruba.it/aruba-bridge/bridge.php';
export const supabaseAnonKey = process.env.ARUBA_BRIDGE_KEY || 'TAM_TAM_ARUBA_BRIDGE_KEY_2026';

export default arubaClient;
