-- Epic-Earth Engine: Initial Schema
-- Accounts, Characters, Inventory, Equipment, Storage

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  email text unique not null,
  created_at timestamptz not null default now(),
  last_login timestamptz
);

create table if not exists characters (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  name text not null,
  job_id text not null default 'novice',
  base_level int not null default 1,
  job_level int not null default 1,
  base_xp bigint not null default 0,
  job_xp bigint not null default 0,
  skill_points int not null default 5,
  stat_points int not null default 0,
  str int not null default 1,
  agi int not null default 1,
  vit int not null default 1,
  int int not null default 1,
  dex int not null default 1,
  luk int not null default 1,
  current_hp int not null default 100,
  current_sp int not null default 50,
  map_id text not null default 'prontera_city',
  pos_x int not null default 15,
  pos_y int not null default 15,
  zeny bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id, name)
);

create table if not exists character_inventory (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  slot_id int not null,
  item_id text not null,
  quantity int not null default 1,
  is_equipped boolean not null default false,
  unique(character_id, slot_id)
);

create table if not exists character_equipment (
  character_id uuid primary key references characters(id) on delete cascade,
  headgear_upper text,
  headgear_middle text,
  headgear_lower text,
  armor text,
  weapon text,
  shield text,
  garment text,
  footwear text,
  accessory_left text,
  accessory_right text
);

create table if not exists storage (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  slot_id int not null,
  item_id text not null,
  quantity int not null default 1,
  unique(account_id, slot_id)
);

create table if not exists character_skills (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  skill_id text not null,
  level int not null default 1,
  unique(character_id, skill_id)
);

create index idx_characters_account on characters(account_id);
create index idx_inventory_character on character_inventory(character_id);
create index idx_storage_account on storage(account_id);
create index idx_skills_character on character_skills(character_id);
