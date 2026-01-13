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

// Item spawn mặc định ban đầu (chỉ type 1 và 2)
export const DEFAULT_SPAWNABLE_TYPES = [1, 2];

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
     * Lấy random type từ danh sách mặc định (1 hoặc 2)
     */
    static getRandomSpawnableType(): number {
        const index = Math.floor(Math.random() * DEFAULT_SPAWNABLE_TYPES.length);
        return DEFAULT_SPAWNABLE_TYPES[index];
    }

    /**
     * Lấy random type từ danh sách đã unlock
     * Luôn đảm bảo có cả type 1 và 2 trong danh sách spawn
     * KHÔNG spawn item level cuối (chỉ đạt được qua merge)
     */
    static getRandomSpawnableTypeFromUnlocked(unlockedTypes: number[]): number {
        // Tìm max level type (item có nextType = 0)
        const maxLevelType = ITEM_CONFIG.find(item => item.nextType === 0)?.type || 999;

        // Bắt đầu với danh sách mặc định (1, 2)
        const spawnableSet = new Set<number>(DEFAULT_SPAWNABLE_TYPES);

        // Thêm các item đã unlock vào danh sách (trừ max level)
        if (unlockedTypes && unlockedTypes.length > 0) {
            for (const type of unlockedTypes) {
                // Không thêm item level cuối vào danh sách spawn
                if (type !== maxLevelType) {
                    spawnableSet.add(type);
                }
            }
        }

        // Chuyển thành mảng và random
        const spawnableArray = Array.from(spawnableSet);
        const index = Math.floor(Math.random() * spawnableArray.length);
        return spawnableArray[index];
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

