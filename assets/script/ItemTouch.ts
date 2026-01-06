import {
    _decorator,
    Component,
    Prefab,
    instantiate,
    Collider2D,
    Contact2DType,
    IPhysics2DContact,
    Vec3,
    director,
    Director,
    tween,
    Sprite,
    BoxCollider2D,
    UITransform,
    Size,
} from 'cc';
import { ItemConfigHelper } from './ItemConfig';
import { GameManager } from './GameManager';
import { AchievementManager } from './AchievementManager';

const { ccclass, property } = _decorator;

@ccclass('ItemTouch')
export class ItemTouch extends Component {

    @property
    itemType: number = 1;  // Loại của item (dùng để so sánh với item khác)

    @property(Prefab)
    itemPrefab: Prefab = null!;  // Prefab chung cho tất cả items (chỉ cần 1 prefab)

    private _hasCollided: boolean = false;  // Đánh dấu đã xử lý va chạm chưa
    private _isSpawnedFromMerge: boolean = false;  // Đánh dấu item được spawn từ merge
    private _spriteLoaded: boolean = false;  // Đánh dấu sprite đã load xong

    // Thời gian item đã tồn tại (để bỏ qua check thua cho item mới spawn)
    private _aliveTime: number = 0;
    public static readonly SPAWN_IMMUNITY_TIME = 1.5;  // 1.5 giây miễn nhiễm sau khi spawn

    // Kiểm tra item có còn trong thời gian miễn nhiễm không
    public isImmune(): boolean {
        return this._aliveTime < ItemTouch.SPAWN_IMMUNITY_TIME;
    }

    // Thời gian delay trước khi merge (cho phép nhiều vật merge cùng lúc)
    private static readonly MERGE_DELAY = 0.15;  // 150ms
    // Thời gian pop-up animation
    private static readonly POPUP_DURATION = 0.6;  // 300ms cho hiệu ứng mượt hơn

    // Tính scale dựa theo itemType - lấy từ config
    static getScaleByType(type: number): number {
        return ItemConfigHelper.getScaleByType(type);
    }

    start() {
        // Lấy collider và bật contact listener
        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }

        // Load sprite từ config theo itemType
        this.loadSpriteFromConfig();

        // Chỉ áp dụng scale nếu KHÔNG phải spawn từ merge
        // (item spawn từ merge sẽ có hiệu ứng pop-up riêng)
        if (!this._isSpawnedFromMerge) {
            this.applyScaleByType();
        }

        // Reset thời gian tồn tại
        this._aliveTime = 0;
    }

    update(dt: number) {
        // Đếm thời gian item tồn tại
        if (this._aliveTime < ItemTouch.SPAWN_IMMUNITY_TIME) {
            this._aliveTime += dt;
        }
    }

    // Load sprite từ config
    loadSpriteFromConfig() {
        const sprite = this.getComponent(Sprite);
        if (!sprite) {
            console.warn('No Sprite component found on item');
            return;
        }

        ItemConfigHelper.loadSpriteForType(this.itemType, sprite, () => {
            this._spriteLoaded = true;
            // Cập nhật collider size sau khi sprite load xong
            this.updateColliderSize();
        });
    }

    // Cập nhật kích thước BoxCollider2D theo kích thước thực của sprite
    updateColliderSize() {
        const sprite = this.getComponent(Sprite);
        const boxCollider = this.getComponent(BoxCollider2D);
        const uiTransform = this.getComponent(UITransform);

        // Bỏ qua nếu thiếu component (không cần warning)
        if (!sprite || !boxCollider) {
            return;
        }

        // Lấy kích thước trực tiếp từ SpriteFrame (chính xác hơn)
        const spriteFrame = sprite.spriteFrame;
        if (!spriteFrame) {
            return;
        }

        // Lấy kích thước gốc của sprite
        const originalSize = spriteFrame.originalSize;

        // Cập nhật UITransform contentSize (để sprite hiển thị đúng)
        if (uiTransform) {
            uiTransform.setContentSize(originalSize.width, originalSize.height);
        }

        // Cập nhật kích thước collider (không tính scale vì physics tự tính)
        boxCollider.size = new Size(originalSize.width, originalSize.height);

        // Apply thay đổi trong frame tiếp theo để đảm bảo physics world đã sẵn sàng
        this.scheduleOnce(() => {
            if (boxCollider && boxCollider.isValid) {
                boxCollider.apply();
            }
        }, 0);

        console.log('Updated collider size to:', originalSize.width, 'x', originalSize.height, 'for type:', this.itemType);
    }

    // Áp dụng scale dựa theo itemType
    applyScaleByType() {
        const scale = ItemTouch.getScaleByType(this.itemType);
        this.node.setScale(scale, scale, 1);
    }

    // Đánh dấu đã unlock achievement chưa (chỉ unlock 1 lần)
    private _achievementUnlocked: boolean = false;

    onBeginContact(selfCollider: Collider2D, otherCollider: Collider2D, _contact: IPhysics2DContact | null) {
        // Unlock achievement khi chạm vào BẤT KỲ thứ gì (sàn, tường, item khác...)
        if (!this._achievementUnlocked) {
            this._achievementUnlocked = true;
            if (AchievementManager.instance) {
                AchievementManager.instance.unlockItem(this.itemType);
            }
        }

        // Lấy component ItemTouch của đối tượng va chạm
        const otherNode = otherCollider.node;
        const otherItemTouch = otherNode.getComponent(ItemTouch);

        // Nếu không phải ItemTouch thì không xử lý merge
        if (!otherItemTouch) return;

        // Nếu đã xử lý va chạm merge rồi thì bỏ qua
        if (this._hasCollided) return;

        // Kiểm tra xem đối tượng kia đã bị xử lý chưa
        if (otherItemTouch._hasCollided) return;

        // Kiểm tra xem hai đối tượng có cùng loại không (chỉ merge khi cùng loại)
        if (this.itemType !== otherItemTouch.itemType) return;

        // Đánh dấu cả hai đã xử lý
        this._hasCollided = true;
        otherItemTouch._hasCollided = true;

        // Lấy parent để thêm vật thể mới (ưu tiên parent của self)
        const parentNode = this.node.parent;
        const selfNode = this.node;

        // Tính vị trí va chạm (trung điểm) bằng LOCAL position
        // Vì các item cùng parent nên dùng local position là đúng nhất
        const selfLocalPos = this.node.position.clone();
        const otherLocalPos = otherNode.position.clone();
        const collisionLocalPos = new Vec3(
            (selfLocalPos.x + otherLocalPos.x) / 2,
            (selfLocalPos.y + otherLocalPos.y) / 2,
            0
        );

        console.log('Self pos:', selfLocalPos.x, selfLocalPos.y);
        console.log('Other pos:', otherLocalPos.x, otherLocalPos.y);
        console.log('Collision pos:', collisionLocalPos.x, collisionLocalPos.y);

        // Lấy nextType từ config
        const nextType = ItemConfigHelper.getNextType(this.itemType);

        // Nếu nextType = 0 nghĩa là max level, không merge được nữa
        if (nextType === 0) {
            console.log('Max level reached, cannot merge further');
            // Bỏ đánh dấu để có thể va chạm lại
            this._hasCollided = false;
            otherItemTouch._hasCollided = false;
            return;
        }

        // Sinh vật thể mới với type tiếp theo sau khi destroy hoàn tất
        if (this.itemPrefab && parentNode) {
            // Clone local position để đảm bảo không bị thay đổi
            const spawnLocalPos = collisionLocalPos.clone();
            const prefabToSpawn = this.itemPrefab;

            // Delay nhẹ để cho phép nhiều vật phẩm cùng merge
            this.scheduleOnce(() => {
                // Hủy cả hai vật thể
                if (selfNode.isValid) selfNode.destroy();
                if (otherNode.isValid) otherNode.destroy();

                // Tạo vật thể mới sau 1 frame
                director.once(Director.EVENT_END_FRAME, () => {
                    if (parentNode.isValid) {
                        const newItem = instantiate(prefabToSpawn);

                        // Đánh dấu item này được spawn từ merge (để start() không override scale)
                        const newItemTouch = newItem.getComponent(ItemTouch);
                        if (newItemTouch) {
                            newItemTouch._isSpawnedFromMerge = true;
                            // Gán itemType mới = type tiếp theo trong chuỗi merge
                            newItemTouch.itemType = nextType;
                            // Truyền prefab chung cho item mới
                            newItemTouch.itemPrefab = prefabToSpawn;
                        }

                        // Lấy scale đích theo type mới
                        const targetScale = ItemTouch.getScaleByType(nextType);

                        // Bắt đầu từ scale nhỏ (0.1) TRƯỚC khi addChild
                        const startScale = 0.1;
                        newItem.setScale(startScale, startScale, 1);

                        // addChild sau khi đã set scale nhỏ
                        parentNode.addChild(newItem);

                        // Set LOCAL position (vì cùng parent)
                        newItem.setPosition(spawnLocalPos.x, spawnLocalPos.y, 0);

                        // Hiệu ứng to dần mượt mà
                        tween(newItem)
                            .to(ItemTouch.POPUP_DURATION,
                                { scale: new Vec3(targetScale, targetScale, 1) },
                                { easing: 'backOut' }  // backOut tạo hiệu ứng nảy nhẹ ở cuối
                            )
                            .start();

                        console.log('Merged to type:', nextType, 'at:', spawnLocalPos.x, spawnLocalPos.y);

                        // Unlock achievement cho item mới
                        console.log('AchievementManager.instance:', AchievementManager.instance);
                        if (AchievementManager.instance) {
                            AchievementManager.instance.unlockItem(nextType);
                        } else {
                            console.warn('⚠️ AchievementManager not found! Hãy gắn script vào scene.');
                        }

                        // Thông báo cho GameManager kiểm tra điều kiện thắng
                        if (GameManager.instance) {
                            GameManager.instance.checkWinCondition(nextType);
                        }
                    }
                });
            }, ItemTouch.MERGE_DELAY);
        } else {
            // Nếu không có prefab thì chỉ destroy
            director.once(Director.EVENT_END_FRAME, () => {
                if (selfNode.isValid) selfNode.destroy();
                if (otherNode.isValid) otherNode.destroy();
            });
        }
    }

    onDestroy() {
        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
    }
}

