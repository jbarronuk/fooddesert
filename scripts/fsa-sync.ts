import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// CONFIG
// ============================================================
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FSA_API_BASE = 'https://api.ratings.food.gov.uk/Establishments/basic';
const FSA_HEADERS = { 'x-api-version': '2' };
const BATCH_SIZE = 500;
const STATE_FILE = path.join(__dirname, '../state.json');

// ============================================================
// TYPES
// ============================================================
interface State {
  page: number;
}

interface FsaEstablishment {
  FHRSID: number;
  LocalAuthorityBusinessID: string | null;
  BusinessName: string | null;
  BusinessType: string | null;
  BusinessTypeID?: number | null;
  RatingValue: string | null;
  RatingDate: string | null;
  RatingKey?: string | null;
  AddressLine1?: string | null;
  AddressLine2?: string | null;
  AddressLine3?: string | null;
  AddressLine4?: string | null;
  PostCode?: string | null;
  Phone?: string | null;
  LocalAuthorityCode?: string | null;
  LocalAuthorityName?: string | null;
  LocalAuthorityEmailAddress?: string | null;
  LocalAuthorityWebSite?: string | null;
  SchemeType?: string | null;
  NewRatingPending?: boolean | null;
  RightToReply?: string | null;
  ChangesByServerID?: number | null;
  Distance?: number | null;
  geocode?: { longitude: string | null; latitude: string | null } | null;
  scores?: {
    Hygiene: number | null;
    Structural: number | null;
    ConfidenceInManagement: number | null;
  } | null;
  links?: { rel: string; href: string }[];
}

interface FsaApiResponse {
  establishments: FsaEstablishment[];
  meta: {
    dataVersion: string;
    apiVersion: string;
    returncode: string;
    totalCount: number;
    returnedCount: number;
    pageSize: number;
    pageNumber: number;
    pageCount: number;
  };
}

interface UpsertParams {
  p_fhrsid: number;
  p_business_name: string | null;
  p_business_type: string | null;
  p_business_type_id: number | null;
  p_address_line1: string | null;
  p_address_line2: string | null;
  p_address_line3: string | null;
  p_address_line4: string | null;
  p_post_code: string | null;
  p_phone: string | null;
  p_local_authority_code: string | null;
  p_local_authority_name: string | null;
  p_local_authority_business_id: string | null;
  p_local_authority_email: string | null;
  p_local_authority_website: string | null;
  p_scheme_type: string | null;
  p_rating_value: string | null;
  p_rating_key: string | null;
  p_rating_date: string | null;
  p_new_rating_pending: boolean | null;
  p_right_to_reply: string | null;
  p_changes_by_server_id: number | null;
  p_distance: number | null;
  p_score_hygiene: number | null;
  p_score_structural: number | null;
  p_score_confidence_in_mgmt: number | null;
  p_longitude: number | null;
  p_latitude: number | null;
}

interface EstablishmentRow extends UpsertParams {
  longitude: number | null;
  latitude: number | null;
}

// ============================================================
// STATE MANAGEMENT
// ============================================================
function readState(): State {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(raw) as State;
  } catch {
    console.log('No state.json found, starting from page 1');
    return { page: 1 };
  }
}

function writeState(state: State): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log(`✓ State saved — next run will use page ${state.page}`);
}

// ============================================================
// FETCH FROM FSA API
// ============================================================
async function fetchEstablishments(page: number): Promise<FsaEstablishment[] | null> {
  const url = `${FSA_API_BASE}/${page}/10000`;
  console.log(`Fetching page ${page} from: ${url}`);

  const response = await fetch(url, { headers: FSA_HEADERS });

  if (response.status === 404) {
    console.log(`Page ${page} returned 404 — resetting to page 1`);
    return null;
  }

  if (!response.ok) {
    throw new Error(`FSA API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as FsaApiResponse;
  console.log(`✓ Fetched ${data.establishments.length} establishments (page ${page} of ${data.meta.pageCount})`);
  console.log(`  Data version: ${data.meta.dataVersion}`);

  return data.establishments;
}

// ============================================================
// MAP FSA RESPONSE TO DB ROW
// ============================================================
function mapToRow(e: FsaEstablishment): EstablishmentRow {
  const longitude = e.geocode?.longitude ? parseFloat(e.geocode.longitude) : null;
  const latitude  = e.geocode?.latitude  ? parseFloat(e.geocode.latitude)  : null;

  return {
    p_fhrsid:                      e.FHRSID,
    p_business_name:               e.BusinessName               ?? null,
    p_business_type:               e.BusinessType               ?? null,
    p_business_type_id:            e.BusinessTypeID             ?? null,
    p_address_line1:               e.AddressLine1               ?? null,
    p_address_line2:               e.AddressLine2               ?? null,
    p_address_line3:               e.AddressLine3               ?? null,
    p_address_line4:               e.AddressLine4               ?? null,
    p_post_code:                   e.PostCode                   ?? null,
    p_phone:                       e.Phone                      ?? null,
    p_local_authority_code:        e.LocalAuthorityCode         ?? null,
    p_local_authority_name:        e.LocalAuthorityName         ?? null,
    p_local_authority_business_id: e.LocalAuthorityBusinessID   ?? null,
    p_local_authority_email:       e.LocalAuthorityEmailAddress ?? null,
    p_local_authority_website:     e.LocalAuthorityWebSite      ?? null,
    p_scheme_type:                 e.SchemeType                 ?? null,
    p_rating_value:                e.RatingValue                ?? null,
    p_rating_key:                  e.RatingKey                  ?? null,
    p_rating_date:                 e.RatingDate                 ?? null,
    p_new_rating_pending:          e.NewRatingPending           ?? null,
    p_right_to_reply:              e.RightToReply               ?? null,
    p_changes_by_server_id:        e.ChangesByServerID          ?? null,
    p_distance:                    e.Distance                   ?? null,
    p_score_hygiene:               e.scores?.Hygiene            ?? null,
    p_score_structural:            e.scores?.Structural         ?? null,
    p_score_confidence_in_mgmt:    e.scores?.ConfidenceInManagement ?? null,
    longitude:                     longitude !== null && !isNaN(longitude) ? longitude : null,
    latitude:                      latitude  !== null && !isNaN(latitude)  ? latitude  : null,
    p_longitude:                   longitude !== null && !isNaN(longitude) ? longitude : null,
    p_latitude:                    latitude  !== null && !isNaN(latitude)  ? latitude  : null,
  };
}

// ============================================================
// UPSERT TO SUPABASE IN BATCHES
// ============================================================
async function upsertBatch(
  supabase: SupabaseClient,
  rows: EstablishmentRow[],
  batchNumber: number,
  totalBatches: number
): Promise<void> {
  const promises = rows.map(row => {
    const params: UpsertParams = {
      p_fhrsid:                      row.p_fhrsid,
      p_business_name:               row.p_business_name,
      p_business_type:               row.p_business_type,
      p_business_type_id:            row.p_business_type_id,
      p_address_line1:               row.p_address_line1,
      p_address_line2:               row.p_address_line2,
      p_address_line3:               row.p_address_line3,
      p_address_line4:               row.p_address_line4,
      p_post_code:                   row.p_post_code,
      p_phone:                       row.p_phone,
      p_local_authority_code:        row.p_local_authority_code,
      p_local_authority_name:        row.p_local_authority_name,
      p_local_authority_business_id: row.p_local_authority_business_id,
      p_local_authority_email:       row.p_local_authority_email,
      p_local_authority_website:     row.p_local_authority_website,
      p_scheme_type:                 row.p_scheme_type,
      p_rating_value:                row.p_rating_value,
      p_rating_key:                  row.p_rating_key,
      p_rating_date:                 row.p_rating_date,
      p_new_rating_pending:          row.p_new_rating_pending,
      p_right_to_reply:              row.p_right_to_reply,
      p_changes_by_server_id:        row.p_changes_by_server_id,
      p_distance:                    row.p_distance,
      p_score_hygiene:               row.p_score_hygiene,
      p_score_structural:            row.p_score_structural,
      p_score_confidence_in_mgmt:    row.p_score_confidence_in_mgmt,
      p_longitude:                   row.p_longitude,
      p_latitude:                    row.p_latitude,
    };
    return supabase.rpc('upsert_establishment', params);
  });

  const results = await Promise.all(promises);
  const errors  = results.filter(r => r.error);

  if (errors.length > 0) {
    console.error(`  ✗ ${errors.length} errors in batch ${batchNumber}:`);
    errors.slice(0, 3).forEach(r => console.error(`    ${r.error?.message}`));
  }

  console.log(`  ✓ Batch ${batchNumber}/${totalBatches} — ${rows.length - errors.length}/${rows.length} upserted`);
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('=== FSA Establishments Sync ===');
  console.log(`Started: ${new Date().toISOString()}\n`);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1. Read current page from state
  const state = readState();
  console.log(`Current page: ${state.page}\n`);

  // 2. Fetch from FSA API
  const establishments = await fetchEstablishments(state.page);

  // 3. Handle 404 — reset to page 1 and exit
  if (establishments === null) {
    writeState({ page: 1 });
    console.log('Reset to page 1. Exiting — data will sync from page 1 on next run.');
    return;
  }

  // 4. Map to DB rows
  const rows = establishments.map(mapToRow);
  console.log(`\nMapped ${rows.length} establishments to DB rows`);
  console.log(`  With coordinates:    ${rows.filter(r => r.p_latitude !== null).length}`);
  console.log(`  Without coordinates: ${rows.filter(r => r.p_latitude === null).length}\n`);

  // 5. Upsert in batches
  const batches: EstablishmentRow[][] = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batches.push(rows.slice(i, i + BATCH_SIZE));
  }

  console.log(`Upserting ${rows.length} rows in ${batches.length} batches of ${BATCH_SIZE}...`);
  for (let i = 0; i < batches.length; i++) {
    await upsertBatch(supabase, batches[i], i + 1, batches.length);
  }

  // 6. Increment page and save state for next run
  writeState({ page: state.page + 1 });

  console.log(`\n✓ Sync complete: ${new Date().toISOString()}`);
}

main().catch(err => {
  console.error('\n✗ Sync failed:', err);
  process.exit(1);
});