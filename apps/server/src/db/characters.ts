import { getServiceClient } from ".";
import type { CharacterEntry, PrimaryStats } from "@epic-earth/shared";
import { calculateDerivedStats, getXpRequired } from "@epic-earth/shared";

interface CharacterRow {
  id: string;
  account_id: string;
  name: string;
  job_id: string;
  base_level: number;
  job_level: number;
  base_xp: number;
  job_xp: number;
  skill_points: number;
  stat_points: number;
  str: number;
  agi: number;
  vit: number;
  int: number;
  dex: number;
  luk: number;
  current_hp: number;
  current_sp: number;
  map_id: string;
  pos_x: number;
  pos_y: number;
  zeny: number;
  created_at: string;
  updated_at: string;
}

function rowToEntry(row: CharacterRow): CharacterEntry {
  return {
    id: row.id,
    name: row.name,
    jobId: row.job_id,
    baseLevel: row.base_level,
    jobLevel: row.job_level,
    mapId: row.map_id,
  };
}

export async function listCharacters(accountId: string): Promise<CharacterEntry[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[DB] listCharacters error:", error);
    return [];
  }

  return (data as CharacterRow[]).map(rowToEntry);
}

export async function createCharacter(
  accountId: string,
  name: string,
  jobId: string
): Promise<{ ok: true; character: CharacterEntry } | { ok: false; error: string }> {
  const supabase = getServiceClient();

  const jobDefaults: Record<string, { str: number; agi: number; vit: number; int: number; dex: number; luk: number; hpFactor: number; spFactor: number }> = {
    novice: { str: 5, agi: 5, vit: 5, int: 5, dex: 5, luk: 5, hpFactor: 8, spFactor: 3 },
    swordman: { str: 9, agi: 4, vit: 7, int: 3, dex: 5, luk: 2, hpFactor: 10, spFactor: 2 },
    mage: { str: 2, agi: 4, vit: 3, int: 9, dex: 7, luk: 5, hpFactor: 5, spFactor: 6 },
    archer: { str: 4, agi: 7, vit: 3, int: 3, dex: 9, luk: 4, hpFactor: 6, spFactor: 4 },
    acolyte: { str: 5, agi: 4, vit: 5, int: 7, dex: 5, luk: 4, hpFactor: 7, spFactor: 5 },
    merchant: { str: 7, agi: 3, vit: 5, int: 5, dex: 5, luk: 5, hpFactor: 9, spFactor: 3 },
    thief: { str: 5, agi: 9, vit: 3, int: 3, dex: 7, luk: 3, hpFactor: 7, spFactor: 3 },
  };

  const defaults = jobDefaults[jobId] ?? jobDefaults.novice;
  const baseLevel = 1;
  const jobLevel = 1;

  const primary: PrimaryStats = {
    str: defaults.str, agi: defaults.agi, vit: defaults.vit,
    int: defaults.int, dex: defaults.dex, luk: defaults.luk,
  };
  const derived = calculateDerivedStats(primary, baseLevel, defaults.hpFactor, defaults.spFactor);

  const { data, error } = await supabase
    .from("characters")
    .insert({
      account_id: accountId,
      name,
      job_id: jobId,
      base_level: baseLevel,
      job_level: jobLevel,
      base_xp: 0,
      job_xp: 0,
      skill_points: 5,
      stat_points: 0,
      str: defaults.str,
      agi: defaults.agi,
      vit: defaults.vit,
      int: defaults.int,
      dex: defaults.dex,
      luk: defaults.luk,
      current_hp: derived.maxHp,
      current_sp: derived.maxSp,
      map_id: "prontera_city",
      pos_x: 15,
      pos_y: 15,
      zeny: 500,
    })
    .select()
    .single();

  if (error) {
    const msg = error.message;
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { ok: false, error: "name already taken" };
    }
    return { ok: false, error: msg };
  }

  return { ok: true, character: rowToEntry(data as CharacterRow) };
}

export async function getCharacter(characterId: string): Promise<CharacterRow | null> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("id", characterId)
    .single();

  if (error || !data) return null;
  return data as CharacterRow;
}

export interface SelectedCharacterData {
  character: CharacterEntry;
  stats: {
    maxHp: number;
    maxSp: number;
    currentHp: number;
    currentSp: number;
    baseLevel: number;
    jobLevel: number;
    baseXp: number;
    jobXp: number;
    xpNeededBase: number;
    xpNeededJob: number;
    str: number;
    agi: number;
    vit: number;
    int: number;
    dex: number;
    luk: number;
  };
  position: { x: number; y: number; z: number };
}

export async function selectCharacter(
  accountId: string,
  characterId: string
): Promise<{ ok: true; data: SelectedCharacterData } | { ok: false; error: string }> {
  const row = await getCharacter(characterId);
  if (!row) {
    return { ok: false, error: "character not found" };
  }
  if (row.account_id !== accountId) {
    return { ok: false, error: "not your character" };
  }

  const primary: PrimaryStats = {
    str: row.str, agi: row.agi, vit: row.vit,
    int: row.int, dex: row.dex, luk: row.luk,
  };

  const jobHpFactors: Record<string, number> = {
    novice: 8, swordman: 10, mage: 5, archer: 6, acolyte: 7, merchant: 9, thief: 7,
  };
  const jobSpFactors: Record<string, number> = {
    novice: 3, swordman: 2, mage: 6, archer: 4, acolyte: 5, merchant: 3, thief: 3,
  };

  const hpFactor = jobHpFactors[row.job_id] ?? 8;
  const spFactor = jobSpFactors[row.job_id] ?? 3;

  const derived = calculateDerivedStats(primary, row.base_level, hpFactor, spFactor);

  return {
    ok: true,
    data: {
      character: rowToEntry(row),
      stats: {
        maxHp: derived.maxHp,
        maxSp: derived.maxSp,
        currentHp: row.current_hp,
        currentSp: row.current_sp,
        baseLevel: row.base_level,
        jobLevel: row.job_level,
        baseXp: row.base_xp,
        jobXp: row.job_xp,
        xpNeededBase: getXpRequired(row.base_level, "base"),
        xpNeededJob: getXpRequired(row.job_level, "job"),
        str: row.str,
        agi: row.agi,
        vit: row.vit,
        int: row.int,
        dex: row.dex,
        luk: row.luk,
      },
      position: { x: row.pos_x, y: row.pos_y, z: 0 },
    },
  };
}
