import { SpriteFrame, resources, Sprite } from 'cc';

/**
 * Cấu hình cho từng loại item
 * itemType: 1, 2, 3... -> tương ứng với item_s1, item_s2, item_s3...
 */
export interface ItemData {
    type: number;           // itemType
    spritePath: string;     // Đường dẫn sprite trong resources
    scale: number;          // Scale của item
    nextType: number;       // Type tiếp theo khi merge (0 = max level, không merge được nữa)
}

// Danh sách config cho tất cả items
// Chỉ giữ lại: 1, 4, 5, 7, 8, 9, 10
export const ITEM_CONFIG: ItemData[] = [
    { type: 1,  spritePath: 'items/item_s1/spriteFrame',  scale: 1.0, nextType: 2 },
    { type: 2,  spritePath: 'items/item_s2/spriteFrame',  scale: 1.2, nextType: 3 },
    { type: 3,  spritePath: 'items/item_s3/spriteFrame',  scale: 1.4, nextType: 4 },
    { type: 4,  spritePath: 'items/item_s4/spriteFrame',  scale: 1.6, nextType: 5 },
    { type: 5,  spritePath: 'items/item_s5/spriteFrame',  scale: 1.8, nextType: 6 },
    { type: 6,  spritePath: 'items/item_s6/spriteFrame',  scale: 2.0, nextType: 7 },
    { type: 7, spritePath: 'items/item_s7/spriteFrame', scale: 2.2, nextType: 0 },  // Max level
];

// Chỉ spawn ngẫu nhiên item type 1 (item đầu tiên)
export const SPAWNABLE_TYPES = [1,2,3,4];

// Helper functions
export class ItemConfigHelper {

    /**
     * Lấy config theo itemType
     */
    static getConfigByType(type: number): ItemData | null {
        return ITEM_CONFIG.find(item => item.type === type) || null;
    }

    /**
     * Lấy scale theo itemType
     */
    static getScaleByType(type: number): number {
        const config = this.getConfigByType(type);
        return config ? config.scale : 1.0;
    }

    /**
     * Lấy type tiếp theo sau khi merge
     */
    static getNextType(type: number): number {
        const config = this.getConfigByType(type);
        return config ? config.nextType : 0;
    }

    /**
     * Lấy random type từ danh sách có thể spawn
     */
    static getRandomSpawnableType(): number {
        const index = Math.floor(Math.random() * SPAWNABLE_TYPES.length);
        return SPAWNABLE_TYPES[index];
    }

    /**
     * Load sprite frame cho item type và gán vào Sprite component
     */
    static loadSpriteForType(type: number, sprite: Sprite, callback?: () => void): void {
        const config = this.getConfigByType(type);
        if (!config) {
            console.warn('ItemConfig not found for type:', type);
            return;
        }

        resources.load(config.spritePath, SpriteFrame, (err, spriteFrame) => {
            if (err) {
                console.error('Failed to load sprite:', config.spritePath, err);
                return;
            }

            if (sprite && sprite.isValid) {
                sprite.spriteFrame = spriteFrame;
                if (callback) callback();
            }
        });
    }
}

