export type ItemType = 
  | "usable" 
  | "weapon" 
  | "shield" 
  | "headgear_upper" 
  | "headgear_middle" 
  | "headgear_lower" 
  | "armor" 
  | "garment" 
  | "footwear" 
  | "accessory" 
  | "card" 
  | "etc"
  | "quest";

export type WeaponClass = 
  | "unarmed" 
  | "dagger" 
  | "one_handed_sword" 
  | "two_handed_sword" 
  | "spear" 
  | "axe" 
  | "mace" 
  | "staff" 
  | "bow" 
  | "katars" 
  | "book";

export interface ItemDefinition {
  id: string;
  name: string;
  type: ItemType;
  description: string;
  buyPrice: number;
  sellPrice: number;
  weight: number;
  slots: number;
  weaponType?: WeaponClass;
  effects?: {
    healHp?: number;
    healSp?: number;
    atk?: number;
    def?: number;
    mdef?: number;
    str?: number;
    agi?: number;
    vit?: number;
    int?: number;
    dex?: number;
    luk?: number;
    requiredLevel?: number;
    
    // Data-driven Buff modifiers
    buffId?: string;
    buffName?: string;
    buffDurationMs?: number;
    buffIcon?: string;
    buffEffects?: {
      str?: number;
      agi?: number;
      vit?: number;
      int?: number;
      dex?: number;
      luk?: number;
      atk?: number;
      def?: number;
      mdef?: number;
      aspdBonus?: number;
      hpBonus?: number;
      spBonus?: number;
    };
  };
}
