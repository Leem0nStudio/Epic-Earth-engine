export type PropertyElement =
  | "neutral"
  | "water"
  | "earth"
  | "fire"
  | "wind"
  | "poison"
  | "holy"
  | "shadow"
  | "ghost"
  | "undead";

export type MonsterSize = "small" | "medium" | "large";

export type MonsterRace =
  | "formless"
  | "undead"
  | "beast"
  | "plant"
  | "insect"
  | "fish"
  | "demon"
  | "demihuman"
  | "angel"
  | "dragon";

export interface SkillEffect {
  type: "damage" | "heal" | "buff" | "debuff";
  value: number;
  duration?: number;
}

export interface Skill {
  id: string;
  name: string;
  castTime: number; // ms
  afterCastDelay: number; // ms
  cooldown: number; // ms
  range: number;
  target: "self" | "single" | "area";
  effects: SkillEffect[];
}

/**
 * Elemental damage multiplier table inspired by Ragnarok Online.
 * [AttackerElement][DefenderElement] = Multiplier (e.g. 1.0 = 100% damage)
 */
export const ELEMENT_MODIFIERS: Record<PropertyElement, Record<PropertyElement, number>> = {
  neutral: {
    neutral: 1.0, water: 1.0, earth: 1.0, fire: 1.0, wind: 1.0,
    poison: 1.0, holy: 1.0, shadow: 1.0, ghost: 0.25, undead: 1.0
  },
  water: {
    neutral: 1.0, water: 0.25, earth: 1.0, fire: 1.5, wind: 0.5,
    poison: 1.0, holy: 0.75, shadow: 1.0, ghost: 1.0, undead: 0.5
  },
  earth: {
    neutral: 1.0, water: 0.5, earth: 0.25, fire: 0.5, wind: 1.5,
    poison: 1.0, holy: 1.0, shadow: 1.0, ghost: 1.0, undead: 1.0
  },
  fire: {
    neutral: 1.0, water: 0.5, earth: 1.5, fire: 0.25, wind: 1.0,
    poison: 1.0, holy: 1.0, shadow: 1.0, ghost: 1.0, undead: 2.0
  },
  wind: {
    neutral: 1.0, water: 2.0, earth: 0.5, fire: 1.0, wind: 0.25,
    poison: 1.0, holy: 1.0, shadow: 1.0, ghost: 1.0, undead: 1.0
  },
  poison: {
    neutral: 1.0, water: 1.0, earth: 1.0, fire: 1.0, wind: 1.0,
    poison: 0.0, holy: 0.5, shadow: 0.5, ghost: 1.0, undead: 1.0
  },
  holy: {
    neutral: 1.0, water: 1.0, earth: 1.0, fire: 1.0, wind: 1.0,
    poison: 1.0, holy: -0.25, shadow: 1.5, ghost: 1.0, undead: 1.5 // negative is healing in RO
  },
  shadow: {
    neutral: 1.0, water: 1.0, earth: 1.0, fire: 1.0, wind: 1.0,
    poison: 0.5, holy: 1.5, shadow: -0.25, ghost: 1.0, undead: -0.25
  },
  ghost: {
    neutral: 0.0, water: 1.0, earth: 1.0, fire: 1.0, wind: 1.0,
    poison: 1.0, holy: 1.0, shadow: 1.0, ghost: 1.25, undead: 1.0
  },
  undead: {
    neutral: 1.0, water: 1.0, earth: 1.0, fire: 1.0, wind: 1.0,
    poison: -0.25, holy: 1.5, shadow: -0.25, ghost: 1.0, undead: -0.25
  }
};

/**
 * Size penalty modifiers for weapons.
 * [WeaponType][MonsterSize] = damage percentage
 */
export const SIZE_PENALTIES: Record<string, Record<MonsterSize, number>> = {
  unarmed: { small: 1.0, medium: 1.0, large: 1.0 },
  dagger: { small: 1.0, medium: 0.75, large: 0.5 }, // daggers do 50% vs large!
  one_handed_sword: { small: 0.75, medium: 1.0, large: 0.75 },
  two_handed_sword: { small: 0.75, medium: 0.75, large: 1.0 },
  bow: { small: 1.0, medium: 1.0, large: 0.75 },
  staff: { small: 1.0, medium: 1.0, large: 1.0 }
};
