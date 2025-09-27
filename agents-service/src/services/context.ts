import { supabaseClient } from '../supabase';
import { loadConfig } from '../config';
import type { AgentRuntimeOverrides, AgentSessionContext, CartItem } from '../agents/types';

type LocationRow = {
  id: string;
  tenant_id: string;
  region: 'EU' | 'RW';
  currency: string;
};

type TableSessionRow = {
  id: string;
  table_id: string;
};

type TableRow = {
  id: string;
  location_id: string;
};

export interface AgentRequestMetadata {
  tenantId?: string;
  locationId?: string;
  tableSessionId?: string;
  userId?: string;
  language?: string;
  allergies?: string[];
  cart?: CartItem[];
  ageVerified?: boolean;
}

async function resolveTableAnchors(tableSessionId: string): Promise<{ locationId: string; tenantId: string }> {
  const { data: session, error: sessionError } = await supabaseClient
    .from('table_sessions')
    .select('id, table_id')
    .eq('id', tableSessionId)
    .maybeSingle<TableSessionRow>();

  if (sessionError) {
    throw new Error(`Unable to load table session: ${sessionError.message}`);
  }
  if (!session) {
    throw new Error('Table session not found');
  }

  const { data: table, error: tableError } = await supabaseClient
    .from('tables')
    .select('id, location_id')
    .eq('id', session.table_id)
    .maybeSingle<TableRow>();

  if (tableError) {
    throw new Error(`Unable to load table metadata: ${tableError.message}`);
  }
  if (!table) {
    throw new Error('Table metadata missing');
  }

  const { data: location, error: locationError } = await supabaseClient
    .from('locations')
    .select('id, tenant_id')
    .eq('id', table.location_id)
    .maybeSingle<{ id: string; tenant_id: string }>();

  if (locationError) {
    throw new Error(`Unable to resolve location from table: ${locationError.message}`);
  }
  if (!location) {
    throw new Error('Location not found for table session');
  }

  return { locationId: location.id, tenantId: location.tenant_id };
}

async function loadLocation(locationId: string): Promise<LocationRow> {
  const { data, error } = await supabaseClient
    .from('locations')
    .select('id, tenant_id, region, currency')
    .eq('id', locationId)
    .maybeSingle<LocationRow>();

  if (error) {
    throw new Error(`Unable to load location: ${error.message}`);
  }
  if (!data) {
    throw new Error('Location not found');
  }

  return data;
}

async function loadMenu(locationId: string) {
  const { data: activeMenu, error: menuError } = await supabaseClient
    .from('menus')
    .select('id')
    .eq('location_id', locationId)
    .eq('is_active', true)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (menuError) {
    throw new Error(`Unable to load active menu: ${menuError.message}`);
  }

  const menuId = activeMenu?.id;
  if (!menuId) {
    throw new Error('No active menu configured for location');
  }

  const { data: items, error: itemsError } = await supabaseClient
    .from('items')
    .select('id, name, description, price_cents, currency, allergens, tags, is_alcohol, is_available, menu_id')
    .eq('menu_id', menuId)
    .order('name')
    .returns<any[]>();

  if (itemsError) {
    throw new Error(`Unable to load menu items: ${itemsError.message}`);
  }

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price_cents: Number(item.price_cents ?? 0),
    currency: item.currency,
    allergens: item.allergens ?? [],
    tags: item.tags ?? [],
    is_alcohol: Boolean(item.is_alcohol),
    is_available: Boolean(item.is_available),
    menu_id: item.menu_id
  }));
}

function normaliseCart(cart?: CartItem[]): CartItem[] {
  if (!cart) return [];
  return cart
    .filter((item) => item && item.item_id && item.quantity > 0)
    .map((item) => ({ item_id: item.item_id, quantity: item.quantity }));
}

export async function buildAgentContext(metadata: AgentRequestMetadata): Promise<AgentSessionContext> {
  let tenantId = metadata.tenantId;
  let locationId = metadata.locationId;

  if (!locationId || !tenantId) {
    if (!metadata.tableSessionId) {
      throw new Error('Location or table session required to run agent');
    }
    const anchors = await resolveTableAnchors(metadata.tableSessionId);
    locationId = locationId ?? anchors.locationId;
    tenantId = tenantId ?? anchors.tenantId;
  }

  const location = await loadLocation(locationId!);
  const menu = await loadMenu(location.id);

  const allergies = (metadata.allergies ?? []).map((value) => value.trim()).filter(Boolean);
  const language = metadata.language ?? 'English';
  const legalDrinkingAge = location.region === 'EU' ? 17 : 18;
  const avoidAlcohol = metadata.ageVerified === true ? false : true;

  const retrievalCache = new Map<string, { expiresAt: number; payload: string }>();
  const defaultTtlMs = config.retrieval.freshnessMs;
  const expiresAt = Date.now() + defaultTtlMs;

  retrievalCache.set(
    'menu',
    {
      expiresAt,
      payload: JSON.stringify(
        menu.map((item) => ({
          id: item.id,
          name: item.name,
          price_cents: item.price_cents,
          currency: item.currency,
          citations: [`menu:${item.id}`]
        }))
      )
    }
  );

  retrievalCache.set(
    'allergens',
    {
      expiresAt,
      payload: JSON.stringify({ declared: allergies, source: 'allergens:policy' })
    }
  );

  retrievalCache.set(
    'policies',
    {
      expiresAt,
      payload: JSON.stringify({
        age_gate: avoidAlcohol
          ? `Do not suggest alcoholic items. Legal drinking age is ${legalDrinkingAge}+.`
          : `Alcohol suggestions permitted when appropriate. Legal drinking age is ${legalDrinkingAge}+.`,
        price_transparency: 'Always state totals with currency.',
        source: 'policies:ops'
      })
    }
  );

  return {
    sessionId: '', // placeholder; caller will inject session id after creation
    tenantId,
    locationId: location.id,
    tableSessionId: metadata.tableSessionId,
    userId: metadata.userId,
    region: location.region,
    language,
    allergies,
    avoidAlcohol,
    legalDrinkingAge,
    menu,
    cart: normaliseCart(metadata.cart),
    kitchenBacklogMinutes: undefined,
    retrievalCache,
    retrievalTtlMs: defaultTtlMs,
    runtimeOverrides: Object.create(null) as Record<string, AgentRuntimeOverrides>,
    activeAgentType: undefined,
    suggestions: []
  } satisfies AgentSessionContext;
}
const config = loadConfig();

export function updateRetrievalCacheTtl(context: AgentSessionContext, minutes: number) {
  const clampedMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : context.retrievalTtlMs / 60_000;
  const ttlMs = Math.max(60_000, Math.floor(clampedMinutes * 60_000));
  // adopt the most restrictive TTL so cached knowledge refreshes promptly when any agent lowers it
  context.retrievalTtlMs = Math.min(context.retrievalTtlMs, ttlMs);
  const newExpiry = Date.now() + context.retrievalTtlMs;
  context.retrievalCache.forEach((entry) => {
    entry.expiresAt = newExpiry;
  });
}

