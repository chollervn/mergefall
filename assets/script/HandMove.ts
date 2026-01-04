import {
    _decorator,
    Component,
    input,
    Input,
    Prefab,
    instantiate,
    Node,
} from 'cc';
import { ItemTouch } from './ItemTouch';
import { ItemConfigHelper } from './ItemConfig';

const { ccclass, property } = _decorator;

@ccclass('handmove')
export class handmove extends Component {

    @property(Prefab)
    itemPrefab: Prefab = null!;  // Prefab chung cho tất cả items

    @property
    speed: number = 200;

    @property
    moveRange: number = 250;

    private _dir = 1;
    private _startX = 0;

    // --- preview item ---
    private _previewItem: Node | null = null;  // Vật phẩm preview hiện tại
    private _nextItemType: number = 1;         // Type của item tiếp theo

    // --- spawn delay ---
    private _canSpawn = true;
    private _spawnCooldown = 0;
    private readonly SPAWN_DELAY = 1; // 1 giây delay giữa các lần spawn

    start () {
        this.node.setPosition(0, 400, 0);
        this._startX = this.node.position.x;

        // Chọn ngẫu nhiên type đầu tiên từ config
        if (this.itemPrefab) {
            this._nextItemType = ItemConfigHelper.getRandomSpawnableType();
            this.createPreviewItem();
        }

        input.on(Input.EventType.TOUCH_START, this.onTouch, this);
    }

    // Tạo vật phẩm preview (hiển thị nhưng không rơi)
    createPreviewItem() {
        // Xóa preview cũ nếu có
        if (this._previewItem && this._previewItem.isValid) {
            this._previewItem.destroy();
            this._previewItem = null;
        }

        if (!this.itemPrefab) return;

        // Tạo preview từ prefab chung
        this._previewItem = instantiate(this.itemPrefab);
        this.node.addChild(this._previewItem);
        this._previewItem.setPosition(0, 0, 0);

        // Set itemType và load sprite tương ứng
        const itemTouch = this._previewItem.getComponent(ItemTouch);
        if (itemTouch) {
            itemTouch.itemType = this._nextItemType;
            itemTouch.itemPrefab = this.itemPrefab;  // Truyền prefab chung
            // Sprite sẽ được load trong start() của ItemTouch
        }

        // Áp dụng scale theo type từ config
        const scale = ItemConfigHelper.getScaleByType(this._nextItemType);
        this._previewItem.setScale(scale, scale, 1);

        // Disable physics để không rơi
        const rigidBody = this._previewItem.getComponent('cc.RigidBody2D');
        if (rigidBody) {
            (rigidBody as any).enabled = false;
        }
    }

    update (dt: number) {
        // --- di chuyển ngang ---
        const pos = this.node.position.clone();
        pos.x += this.speed * this._dir * dt;

        // Clamp position để không vượt quá phạm vi
        const minX = this._startX - this.moveRange;
        const maxX = this._startX + this.moveRange;

        if (pos.x <= minX) {
            pos.x = minX;
            this._dir = 1;
        } else if (pos.x >= maxX) {
            pos.x = maxX;
            this._dir = -1;
        }

        this.node.setPosition(pos);

        // --- đếm cooldown spawn ---
        if (!this._canSpawn) {
            this._spawnCooldown += dt;
            if (this._spawnCooldown >= this.SPAWN_DELAY) {
                this._canSpawn = true;
                this._spawnCooldown = 0;

                // Tạo preview mới khi hết cooldown
                this.createPreviewItem();
            }
        }
    }

    onTouch () {
        // Kiểm tra cooldown trước khi spawn
        if (!this._canSpawn) {
            return;
        }

        if (!this.itemPrefab) return;

        // Spawn vật phẩm thật (có physics)
        const obj = instantiate(this.itemPrefab);

        // Set itemType và prefab cho item mới
        const itemTouch = obj.getComponent(ItemTouch);
        if (itemTouch) {
            itemTouch.itemType = this._nextItemType;
            itemTouch.itemPrefab = this.itemPrefab;
        }

        // Áp dụng scale theo type từ config
        const scale = ItemConfigHelper.getScaleByType(this._nextItemType);
        obj.setScale(scale, scale, 1);

        this.node.parent!.addChild(obj);

        const wp = this.node.worldPosition;
        obj.setWorldPosition(wp.x, wp.y, wp.z);

        // Xóa preview item
        if (this._previewItem && this._previewItem.isValid) {
            this._previewItem.destroy();
            this._previewItem = null;
        }

        // Bắt đầu cooldown
        this._canSpawn = false;
        this._spawnCooldown = 0;

        // Chọn type tiếp theo từ config (nhưng chưa tạo preview)
        this._nextItemType = ItemConfigHelper.getRandomSpawnableType();
    }


    onDestroy () {
        input.off(Input.EventType.TOUCH_START, this.onTouch, this);
    }



}
