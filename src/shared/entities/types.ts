import { Entity as ECSEntity, ComponentMap } from "../core/ecs";

export type EntityType = "player" | "monster" | "npc" | "pet" | "summon" | "portal";
export type EntityState = "idle" | "walk" | "attack" | "hit" | "die" | "following" | "alert" | "casting";

export interface EntityPosition {
  x: number;
  y: number;
  z: number;
  targetX?: number;
  targetY?: number;
  speed: number;
  direction: number;
  path?: [number, number][];
}

export interface CombatComponent {
  isCasting: boolean;
  castProgress: number;
  totalCastTime: number;
  lastAttackTime: number;
  attackCooldown: number;
  targetEntityId?: string;
  activeSkill?: { id: string; level: number; targetId: string };
  skills: { id: string; level: number }[];
}

export interface EntityStats {
  currentHp: number;
  maxHp: number;
  currentSp: number;
  maxSp: number;
  str: number;
  agi: number;
  vit: number;
  int: number;
  dex: number;
  luk: number;
  atkMin?: number;
  atkMax?: number;
  [key: string]: any;
}

/**
 * CommonEntity: The base entity class representing any dynamic entity in the game world.
 * All specific entity types (Player, Monster, NPC, Pet, Summon, etc.) derive from this class.
 */
export abstract class CommonEntity implements ECSEntity {
  public id: string;
  public type: EntityType;
  public position: EntityPosition;
  public stats: EntityStats;
  public state: EntityState;
  
  // ECS Compatibility map - fully integrated so other modules continue to work seamlessly
  public components: Partial<ComponentMap>;

  constructor(
    id: string,
    type: EntityType,
    position: EntityPosition,
    stats: EntityStats,
    state: EntityState = "idle"
  ) {
    this.id = id;
    this.type = type;
    this.position = position;
    this.stats = stats;
    this.state = state;

    // Sync to components property to retain full compatibility with ECS and React Three Fiber rendering
    this.components = {
      identity: { id, name: id, type: type as any },
      position: this.position,
      stats: this.stats as any,
      render: {
        spriteSheetId: "",
        currentAnimation: state as any,
        isFlipX: false,
        scale: 1.0,
      },
    };
  }

  public setState(state: EntityState) {
    this.state = state;
    if (this.components.render) {
      this.components.render.currentAnimation = state as any;
    }
  }

  public setPosition(x: number, y: number, z: number = 0) {
    this.position.x = x;
    this.position.y = y;
    this.position.z = z;
  }
}

/**
 * Player Entity (Jugador)
 */
export class PlayerEntity extends CommonEntity {
  public name: string;
  public jobId: string;
  public baseLevel: number;
  public jobLevel: number;
  
  constructor(
    id: string,
    name: string,
    jobId: string,
    position: EntityPosition,
    stats: EntityStats,
    state: EntityState = "idle"
  ) {
    super(id, "player", position, stats, state);
    this.name = name;
    this.jobId = jobId;
    this.baseLevel = 1;
    this.jobLevel = 1;

    this.components.identity!.name = name;
    this.components.job = {
      jobId,
      baseLevel: this.baseLevel,
      jobLevel: this.jobLevel,
      baseXp: 0,
      jobXp: 0,
      skillPoints: 5,
    };
    this.components.inventory = { slots: [], maxSlots: 100 };
    this.components.equipment = {};
    if (this.components.render) {
      this.components.render.spriteSheetId = `char_${jobId}`;
    }
  }
}

/**
 * Monster Entity (Monstruo)
 */
export class MonsterEntity extends CommonEntity {
  public name: string;
  public monsterId: string;
  public level: number;
  public drops: { itemId: string; rate: number }[];
  public aiType: string;
  public xpReward: number;

  constructor(
    id: string,
    name: string,
    monsterId: string,
    level: number,
    drops: { itemId: string; rate: number }[],
    aiType: string,
    xpReward: number,
    position: EntityPosition,
    stats: EntityStats,
    state: EntityState = "idle"
  ) {
    super(id, "monster", position, stats, state);
    this.name = name;
    this.monsterId = monsterId;
    this.level = level;
    this.drops = drops;
    this.aiType = aiType;
    this.xpReward = xpReward;

    this.components.identity!.name = name;
    if (this.components.render) {
      this.components.render.spriteSheetId = `mob_${monsterId}`;
      this.components.render.scale = monsterId === "baphomet" ? 2.5 : 1.0;
    }
  }
}

/**
 * NPC Entity
 */
export interface NpcInteraction {
  type: "dialogue" | "shop" | "warp" | "quest";
  data: any;
}

export class NpcEntity extends CommonEntity {
  public name: string;
  public spriteSheetId: string;
  public interactions: NpcInteraction[];

  constructor(
    id: string,
    name: string,
    spriteSheetId: string,
    interactions: NpcInteraction[] = [],
    position: EntityPosition,
    stats: EntityStats,
    state: EntityState = "idle"
  ) {
    super(id, "npc", position, stats, state);
    this.name = name;
    this.spriteSheetId = spriteSheetId;
    this.interactions = interactions;

    this.components.identity!.name = name;
    if (this.components.render) {
      this.components.render.spriteSheetId = spriteSheetId;
    }
  }
}

/**
 * Pet Entity (Mascota)
 */
export class PetEntity extends CommonEntity {
  public name: string;
  public ownerId: string;
  public intimacy: number;
  public hunger: number;

  constructor(
    id: string,
    name: string,
    ownerId: string,
    position: EntityPosition,
    stats: EntityStats,
    state: EntityState = "idle"
  ) {
    super(id, "pet", position, stats, state);
    this.name = name;
    this.ownerId = ownerId;
    this.intimacy = 500;
    this.hunger = 50;

    this.components.identity!.name = name;
    if (this.components.render) {
      this.components.render.spriteSheetId = "pet_poring";
      this.components.render.scale = 0.75;
    }
  }
}

/**
 * Summon Entity (Invocación)
 */
export class SummonEntity extends CommonEntity {
  public name: string;
  public creatorId: string;
  public duration: number; // lifespan in seconds before auto-unspawning

  constructor(
    id: string,
    name: string,
    creatorId: string,
    position: EntityPosition,
    stats: EntityStats,
    duration: number = 60,
    state: EntityState = "idle"
  ) {
    super(id, "summon", position, stats, state);
    this.name = name;
    this.creatorId = creatorId;
    this.duration = duration;

    this.components.identity!.name = name;
    if (this.components.render) {
      this.components.render.spriteSheetId = "summon_spirit";
      this.components.render.scale = 0.85;
    }
  }
}
