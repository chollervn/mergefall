import {
    _decorator,
    Component,
    Node,
    Sprite,
    SpriteFrame,
    Color,
    resources,
} from 'cc';
import { ITEM_CONFIG, ItemConfigHelper } from './ItemConfig';

const { ccclass, property } = _decorator;

/**
 * AchievementManager - Quản lý thanh achievement hiển thị các item đã đạt được
 */
@ccclass('AchievementManager')
export class AchievementManager extends Component {

    // Singleton instance
    private static _instance: AchievementManager | null = null;
    public static get instance(): AchievementManager | null {
        return AchievementManager._instance;
    }

    @property([Node])
    itemSlots: Node[] = [];  // Các slot hiển thị item trong achievement bar (kéo thả từ Cocos)

    // Lưu trạng thái item đã unlock
    private _unlockedItems: Set<number> = new Set();

    // Key lưu vào localStorage
    private static readonly STORAGE_KEY = 'achievement_unlocked_items';

    onLoad() {
        // Reset singleton khi scene reload (quan trọng!)
        AchievementManager._instance = this;
        console.log('✅ AchievementManager initialized!');

        // Reset tất cả achievement khi bắt đầu game mới
        this._unlockedItems = new Set();
        localStorage.removeItem(AchievementManager.STORAGE_KEY);
        console.log('🔄 All achievements reset on game start');
    }

    start() {
        // Đảm bảo node luôn active
        this.node.active = true;

        // Nếu không có slot nào được gán, tự động tìm từ children
        if (this.itemSlots.length === 0) {
            console.log('⚠️ No slots assigned, auto-finding from children...');
            this.itemSlots = [];
            for (const child of this.node.children) {
                if (child.getComponent(Sprite)) {
                    this.itemSlots.push(child);
                }
            }
            console.log(`   Found ${this.itemSlots.length} slots from children`);
        }

        // Đảm bảo tất cả slots đều active
        for (const slot of this.itemSlots) {
            if (slot) slot.active = true;
        }

        console.log('🎯 AchievementManager start - slots:', this.itemSlots.length);

        this.loadAllSprites();
    }

    /**
     * Load sprite cho tất cả slot theo thứ tự item type
     */
    private loadAllSprites() {
        for (let i = 0; i < this.itemSlots.length; i++) {
            const slot = this.itemSlots[i];
            if (!slot) continue;

            const sprite = slot.getComponent(Sprite);
            if (!sprite) {
                console.warn(`Slot ${i} không có Sprite component`);
                continue;
            }

            // Item type bắt đầu từ 1
            const itemType = i + 1;
            const config = ItemConfigHelper.getConfigByType(itemType);

            if (!config) {
                console.warn(`Không tìm thấy config cho item type ${itemType}`);
                continue;
            }

            // Load sprite từ resources
            resources.load(config.spritePath, SpriteFrame, (err, spriteFrame) => {
                if (err) {
                    console.error(`❌ Failed to load sprite for type ${itemType}:`, err);
                    return;
                }

                if (sprite && sprite.isValid) {
                    sprite.spriteFrame = spriteFrame;
                    // Cập nhật màu dựa vào trạng thái unlock
                    this.updateSlotColor(i, itemType);
                }
            });
        }
    }

    /**
     * Cập nhật màu của 1 slot
     */
    private updateSlotColor(slotIndex: number, itemType: number) {
        const slot = this.itemSlots[slotIndex];
        if (!slot) return;

        const sprite = slot.getComponent(Sprite);
        if (!sprite) return;

        const isUnlocked = this._unlockedItems.has(itemType);

        if (isUnlocked) {
            // Đã unlock - màu đầy đủ (trắng = hiển thị màu gốc)
            sprite.color = new Color(255, 255, 255, 255);
        } else {
            // Chưa unlock - màu xám mờ
            sprite.color = new Color(80, 80, 80, 120);
        }
    }

    /**
     * Cập nhật giao diện toàn bộ achievement bar
     */
    private updateUI() {
        for (let i = 0; i < this.itemSlots.length; i++) {
            const itemType = i + 1;
            this.updateSlotColor(i, itemType);
        }
    }

    /**
     * Unlock item khi người chơi merge thành công
     * @param itemType Type của item vừa được tạo từ merge
     */
    public unlockItem(itemType: number) {
        // Đã unlock rồi thì bỏ qua
        if (this._unlockedItems.has(itemType)) {
            return;
        }

        this._unlockedItems.add(itemType);
        this.saveUnlockedItems();
        this.updateUI();

        console.log(`🏆 Achievement unlocked: Item type ${itemType}`);
    }

    /**
     * Lưu dữ liệu vào localStorage
     */
    private saveUnlockedItems() {
        try {
            const data = Array.from(this._unlockedItems);
            localStorage.setItem(AchievementManager.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save achievement data:', e);
        }
    }

    /**
     * Load dữ liệu từ localStorage
     */
    private loadUnlockedItems() {
        try {
            const saved = localStorage.getItem(AchievementManager.STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved) as number[];
                this._unlockedItems = new Set(data);
                console.log('Loaded achievements:', data);
            }
        } catch (e) {
            console.warn('Failed to load achievement data:', e);
            this._unlockedItems = new Set();
        }
    }

    /**
     * Reset tất cả achievement (debug hoặc chơi lại từ đầu)
     */
    public resetAll() {
        this._unlockedItems.clear();
        localStorage.removeItem(AchievementManager.STORAGE_KEY);
        this.updateUI();
        console.log('🔄 All achievements reset');
    }

    /**
     * Kiểm tra item đã unlock chưa
     */
    public isUnlocked(itemType: number): boolean {
        return this._unlockedItems.has(itemType);
    }

    /**
     * Lấy số lượng item đã unlock
     */
    public getUnlockedCount(): number {
        return this._unlockedItems.size;
    }

    /**
     * Lấy tổng số item có thể unlock
     */
    public getTotalItems(): number {
        return ITEM_CONFIG.length;
    }

    onDestroy() {
        if (AchievementManager._instance === this) {
            AchievementManager._instance = null;
        }
    }
}

