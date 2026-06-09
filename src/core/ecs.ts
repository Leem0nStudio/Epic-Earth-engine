export type EntityId = string;

export interface ComponentMap {
  position: {
    x: number;
    y: number;
    z: number;
    targetX?: number;
    targetY?: number;
    speed: number; // grid units per second
    direction: number; // 0 to 7 (8-directional system typical of RO)
    path?: [number, number][]; // calculated A* grid node path
  };
  stats: {
    baseHp: number;
    baseSp: number;
    currentHp: number;
    currentSp: number;
    str: number;
    agi: number;
    vit: number;
    int: number;
    dex: number;
    luk: number;
    // Calculated stats
    maxHp: number;
    maxSp: number;
    atkMin: number;
    atkMax: number;
    defHard: number;
    defSoft: number;
    mdefHard: number;
    mdefSoft: number;
    hit: number;
    flee: number;
    crit: number;
    aspd: number; // 0 to 190 (Ragnarok Online system, where 190 is 5 attacks/sec)
    castTimeMultiplier: number; // e.g. 1.0 (no reduction) to 0.0 (instant cast)
  };
  render: {
    spriteSheetId: string; // id for the R3F billboards (RO sprites)
    currentAnimation: "idle" | "walk" | "attack" | "hit" | "die";
    isFlipX: boolean;
    scale: number;
  };
  job: {
    jobId: string; // e.g. "novice", "swordman"
    baseLevel: number;
    jobLevel: number;
    baseXp: number;
    jobXp: number;
    skillPoints: number;
  };
  inventory: {
    slots: {
      slotId: number;
      itemId: string;
      quantity: number;
      isEquipped?: boolean;
    }[];
    maxSlots: number;
  };
  equipment: {
    headgearUpper?: string;
    headgearMiddle?: string;
    headgearLower?: string;
    armor?: string;
    weapon?: string;
    shield?: string;
    garment?: string;
    footwear?: string;
    accessoryLeft?: string;
    accessoryRight?: string;
  };
  combat: {
    targetEntityId?: EntityId;
    isCasting: boolean;
    castProgress: number; // 0 to 1
    totalCastTime: number; // in seconds
    activeSkill?: { id: string; level: number; targetId: string };
    skills: { id: string; level: number }[];
    lastAttackTime: number; // timestamp MS
    attackCooldown: number; // MS between attacks based on ASPD
  };
  identity: {
    id: EntityId;
    name: string;
    type: "player" | "monster" | "npc" | "portal" | "pet" | "summon";
  };
}

export type ComponentName = keyof ComponentMap;

export interface Entity {
  id: EntityId;
  components: Partial<ComponentMap>;
}

export class ECSWorld {
  private entities: Map<EntityId, Entity> = new Map();
  private systems: ECSSystem[] = [];

  public createEntity(id: EntityId, initialComponents: Partial<ComponentMap> = {}): Entity {
    const entity: Entity = {
      id,
      components: initialComponents,
    };
    // Always attach identity if missing
    if (!entity.components.identity) {
      entity.components.identity = {
        id,
        name: `Entity_${id}`,
        type: "npc",
      };
    }
    this.entities.set(id, entity);
    return entity;
  }

  public registerExistingEntity(entity: Entity): void {
    this.entities.set(entity.id, entity);
  }

  public getEntity(id: EntityId): Entity | undefined {
    return this.entities.get(id);
  }

  public removeEntity(id: EntityId): boolean {
    return this.entities.delete(id);
  }

  public getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  public addComponent<K extends ComponentName>(id: EntityId, name: K, component: ComponentMap[K]): void {
    const entity = this.entities.get(id);
    if (entity) {
      entity.components[name] = component;
    }
  }

  public removeComponent(id: EntityId, name: ComponentName): void {
    const entity = this.entities.get(id);
    if (entity) {
      delete entity.components[name];
    }
  }

  public queryEntities<K extends ComponentName>(requiredComponents: K[]): Entity[] {
    return this.getAllEntities().filter((entity) =>
      requiredComponents.every((name) => entity.components[name] !== undefined)
    );
  }

  public addSystem(system: ECSSystem): void {
    this.systems.push(system);
  }

  public update(deltaTime: number): void {
    for (const system of this.systems) {
      system.update(this, deltaTime);
    }
  }
}

export interface ECSSystem {
  update(world: ECSWorld, deltaTime: number): void;
}
