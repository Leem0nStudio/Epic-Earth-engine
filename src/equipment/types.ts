import { ItemType } from "../items/types";

export interface EquipmentGrid {
  headgearUpper?: string;   // Slot 1: Apple of Archer, Corsair, Ribbon, etc.
  headgearMiddle?: string;  // Slot 2: Sunglasses, Masquerade, etc.
  headgearLower?: string;   // Slot 3: Pipe, Cigar, Flower, etc.
  armor?: string;           // Slot 4: Odin's Blessing, Plate Mail, Thief Clothes
  weapon?: string;          // Slot 5: Knife, Composite Bow, Katana, Sword
  shield?: string;          // Slot 6: Iron Shield, Guard, Buckler, Valkyrie Shield
  garment?: string;         // Slot 7: Muffler, Manteau, Hood
  footwear?: string;        // Slot 8: Shoes, Boots, Greaves
  accessoryLeft?: string;    // Slot 9: Clip, Ring, Glove, Clip of Mustle
  accessoryRight?: string;   // Slot 10: Clip, Ring, Glove, Brooch
}

export type EquipmentSlotName = keyof EquipmentGrid;

/**
 * Maps an item's type to its corresponding equipment slot.
 */
export function getAvailableSlotsForItemType(type: ItemType): EquipmentSlotName[] {
  switch (type) {
    case "headgear_upper":
      return ["headgearUpper"];
    case "headgear_middle":
      return ["headgearMiddle"];
    case "headgear_lower":
      return ["headgearLower"];
    case "armor":
      return ["armor"];
    case "weapon":
      return ["weapon"];
    case "shield":
      return ["shield"];
    case "garment":
      return ["garment"];
    case "footwear":
      return ["footwear"];
    case "accessory":
      return ["accessoryLeft", "accessoryRight"];
    default:
      return [];
  }
}
