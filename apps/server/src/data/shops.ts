import * as fs from "fs";
import { resolve } from "path";

export interface ShopEntry {
  npcId: string;
  items: { itemId: string; stock: number }[];
  sellRate: number;
}

const SHOPS: ShopEntry[] = [
  {
    npcId: "prontera_tool_dealer",
    items: [
      { itemId: "red_potion", stock: 100 },
      { itemId: "blue_potion", stock: 50 },
      { itemId: "blessing_scroll", stock: 20 },
      { itemId: "increase_agi_scroll", stock: 20 },
    ],
    sellRate: 0.5,
  },
  {
    npcId: "prontera_weapon_smith",
    items: [
      { itemId: "knife", stock: 10 },
      { itemId: "composite_bow", stock: 5 },
      { itemId: "gladius_weapon", stock: 3 },
    ],
    sellRate: 0.5,
  },
  {
    npcId: "prontera_armor_dealer",
    items: [
      { itemId: "iron_shield", stock: 5 },
    ],
    sellRate: 0.5,
  },
  {
    npcId: "prontera_food_vendor",
    items: [
      { itemId: "grilled_griffin_food", stock: 10 },
      { itemId: "honey_herbal_tea", stock: 10 },
    ],
    sellRate: 0.4,
  },
];

export function getShop(npcId: string): ShopEntry | undefined {
  return SHOPS.find((s) => s.npcId === npcId);
}

export function getShopItems(npcId: string): { itemId: string; price: number; stock: number }[] {
  const shop = getShop(npcId);
  if (!shop) return [];

  const { items, sellRate } = shop;
  return items.map(({ itemId, stock }) => {
    const item = getItemData(itemId);
    return {
      itemId,
      price: item?.buyPrice ?? 0,
      stock,
    };
  });
}

interface ItemData {
  id: string;
  buyPrice: number;
  sellPrice: number;
}

let _itemCatalog: ItemData[] = [];
let _catalogLoaded = false;

export function loadItemCatalog(): void {
  if (_catalogLoaded) return;
  try {
    const catalogPath = resolve(__dirname, "../../../apps/client/src/data/items.json");
    const raw = fs.readFileSync(catalogPath, "utf-8");
    const parsed = JSON.parse(raw);
    _itemCatalog = (parsed.items || []).map((i: any) => ({
      id: i.id,
      buyPrice: i.buyPrice ?? 0,
      sellPrice: i.sellPrice ?? 0,
    }));
    _catalogLoaded = true;
    console.log(`[Shops] loaded ${_itemCatalog.length} items for pricing`);
  } catch (e) {
    console.warn("[Shops] could not load item catalog:", (e as Error).message);
  }
}

export function getItemData(itemId: string): ItemData | undefined {
  return _itemCatalog.find((i) => i.id === itemId);
}
