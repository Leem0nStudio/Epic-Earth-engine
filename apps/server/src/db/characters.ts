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

export async function ensureAccount(accountId: string, username: string): Promise<void> {
  const supabase = getServiceClient();

  // Try insert first — email is only set on first creation to avoid unique collisions
  const { error: insertError } = await supabase.from("accounts").insert({
    id: accountId, username, email: username,
  });

  if (insertError && (insertError as any).code === "23505") {
    // Account exists — just update username and last_login
    const { error: updateError } = await supabase
      .from("accounts")
      .update({ username, last_login: new Date().toISOString() })
      .eq("id", accountId);

    if (updateError) {
      console.error("[DB] ensureAccount update error:", updateError);
    }
  } else if (insertError) {
    console.error("[DB] ensureAccount insert error:", insertError);
  }
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

const FIRST_CLASS_JOBS = new Set(["novice"]);

const jobDefaults: Record<string, { str: number; agi: number; vit: number; int: number; dex: number; luk: number; hpFactor: number; spFactor: number }> = {
  novice: { str: 5, agi: 5, vit: 5, int: 5, dex: 5, luk: 5, hpFactor: 6, spFactor: 1 },
  swordman: { str: 9, agi: 4, vit: 7, int: 3, dex: 5, luk: 2, hpFactor: 14, spFactor: 2 },
  mage: { str: 2, agi: 4, vit: 3, int: 9, dex: 7, luk: 5, hpFactor: 7, spFactor: 6 },
  archer: { str: 4, agi: 7, vit: 3, int: 3, dex: 9, luk: 3, hpFactor: 9, spFactor: 3 },
  acolyte: { str: 5, agi: 4, vit: 5, int: 7, dex: 5, luk: 4, hpFactor: 8, spFactor: 5 },
  merchant: { str: 7, agi: 3, vit: 5, int: 5, dex: 5, luk: 5, hpFactor: 11, spFactor: 3 },
  thief: { str: 5, agi: 9, vit: 3, int: 3, dex: 7, luk: 3, hpFactor: 10, spFactor: 2 },
  knight: { str: 9, agi: 4, vit: 8, int: 3, dex: 5, luk: 2, hpFactor: 20, spFactor: 3 },
  wizard: { str: 2, agi: 4, vit: 3, int: 9, dex: 7, luk: 5, hpFactor: 9, spFactor: 9 },
  hunter: { str: 4, agi: 7, vit: 3, int: 3, dex: 9, luk: 4, hpFactor: 12, spFactor: 4 },
  blacksmith: { str: 9, agi: 4, vit: 6, int: 3, dex: 6, luk: 3, hpFactor: 16, spFactor: 4 },
};

export async function createCharacter(
  accountId: string,
  name: string,
  jobId?: string
): Promise<{ ok: true; character: CharacterEntry } | { ok: false; error: string }> {
  if (jobId && !FIRST_CLASS_JOBS.has(jobId)) {
    return { ok: false, error: "only first-class jobs allowed at creation" };
  }

  if (!name || name.trim().length === 0 || name.length > 16) {
    return { ok: false, error: "name must be between 1 and 16 characters" };
  }
  if (!/^[a-zA-Z0-9_\-\u00C0-\u024F]+$/.test(name)) {
    return { ok: false, error: "name contains invalid characters" };
  }

  const actualJobId = "novice";
  const supabase = getServiceClient();

  const defaults = jobDefaults[actualJobId] ?? jobDefaults.novice;
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
      job_id: actualJobId,
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
    if ((error as any).code === "23505") {
      return { ok: false, error: "name already taken" };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, character: rowToEntry(data as CharacterRow) };
}

export async function updateCharacterPosition(characterId: string, x: number, y: number): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("characters")
    .update({ pos_x: x, pos_y: y, updated_at: new Date().toISOString() })
    .eq("id", characterId);
  if (error) {
    console.error("[DB] updateCharacterPosition error:", error);
  }
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
    statPoints: number;
    skillPoints: number;
  };
  position: { x: number; y: number; z: number };
  inventory?: { slotId: number; itemId: string; quantity: number; isEquipped: boolean }[];
  equipment?: Record<string, string | undefined>;
  skills?: { skillId: string; level: number }[];
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

  const jd = jobDefaults[row.job_id] ?? jobDefaults.novice;
  const derived = calculateDerivedStats(primary, row.base_level, jd.hpFactor, jd.spFactor);

  // Load inventory
  const supabase = getServiceClient();
  const { data: invData } = await supabase
    .from("character_inventory")
    .select("slot_id, item_id, quantity, is_equipped")
    .eq("character_id", characterId)
    .order("slot_id", { ascending: true });

  // Load equipment
  const { data: eqData } = await supabase
    .from("character_equipment")
    .select("*")
    .eq("character_id", characterId)
    .single();

  // Load skills
  const { data: skillData } = await supabase
    .from("character_skills")
    .select("skill_id, level")
    .eq("character_id", characterId);

  const inventory = (invData || []).map((r: any) => ({
    slotId: r.slot_id, itemId: r.item_id, quantity: r.quantity, isEquipped: r.is_equipped,
  }));

  const equipment = eqData
    ? {
        headgearUpper: eqData.headgear_upper,
        headgearMiddle: eqData.headgear_middle,
        headgearLower: eqData.headgear_lower,
        armor: eqData.armor,
        weapon: eqData.weapon,
        shield: eqData.shield,
        garment: eqData.garment,
        footwear: eqData.footwear,
        accessoryLeft: eqData.accessory_left,
        accessoryRight: eqData.accessory_right,
      }
    : undefined;

  const skills = (skillData || []).map((r: any) => ({
    skillId: r.skill_id, level: r.level,
  }));

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
        statPoints: row.stat_points,
        skillPoints: row.skill_points,
      },
      position: { x: row.pos_x, y: row.pos_y, z: 0 },
      inventory,
      equipment,
      skills,
    },
  };
}
