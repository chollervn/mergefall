import {
    _decorator,
    Component,
    input,
    Input,
    Prefab,
    instantiate,
    Node,
    Graphics,
    Color,
    UITransform,
    view,
    PhysicsSystem2D,
    Vec2,
    ERaycast2DType,
} from 'cc';
import { ItemTouch } from './ItemTouch';
import { ItemConfigHelper } from './ItemConfig';
import { AchievementManager } from './AchievementManager';

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

    // --- tia dọc ---
    private _lineNode: Node | null = null;
    private _graphics: Graphics | null = null;
    private _showLine: boolean = true; // Kiểm soát hiển thị tia dọc
    private _cachedStartPoint: Vec2 = new Vec2(); // Cache để tránh tạo mới mỗi frame
    private _cachedEndPoint: Vec2 = new Vec2();
    private _lastLineLength: number = 0; // Cache độ dài tia để tránh vẽ lại không cần thiết

    @property
    lineColor: Color = new Color(255, 255, 255, 100); // Màu trắng, độ trong suốt 100

    @property
    lineWidth: number = 2; // Độ dày của tia

    start () {
        this.node.setPosition(0, 500, 0);
        this._startX = this.node.position.x;

        // Tạo tia dọc
        this.createVerticalLine();

        // Chọn ngẫu nhiên type đầu tiên từ config (ban đầu chỉ có 1 hoặc 2)
        if (this.itemPrefab) {
            this._nextItemType = this.getNextSpawnType();
            this.createPreviewItem();
        }

        input.on(Input.EventType.TOUCH_START, this.onTouch, this);
    }

    // Tạo tia dọc chiếu xuống
    createVerticalLine() {
        // Tạo node cho tia
        this._lineNode = new Node('VerticalLine');
        this.node.addChild(this._lineNode);
        this._lineNode.setPosition(0, 0, 0);

        // Thêm UITransform
        const uiTransform = this._lineNode.addComponent(UITransform);

        // Thêm Graphics component để vẽ
        this._graphics = this._lineNode.addComponent(Graphics);
        this._graphics.strokeColor = this.lineColor;
        this._graphics.lineWidth = this.lineWidth;

        // Vẽ tia dọc (từ vị trí hand xuống dưới)
        this.drawVerticalLine();
    }

    // Vẽ tia dọc
    drawVerticalLine() {
        if (!this._graphics) return;

        // Nếu không hiển thị tia, chỉ clear và return
        if (!this._showLine) {
            if (this._lastLineLength !== 0) {
                this._graphics.clear();
                this._lastLineLength = 0;
            }
            return;
        }

        // Lấy vị trí world của hand
        const worldPos = this.node.worldPosition;

        // Lấy chiều cao màn hình để tính độ dài tia tối đa
        const visibleSize = view.getVisibleSize();
        const maxLineLength = visibleSize.height;

        // Sử dụng cached vectors thay vì tạo mới
        this._cachedStartPoint.set(worldPos.x, worldPos.y);
        this._cachedEndPoint.set(worldPos.x, worldPos.y - maxLineLength);

        // Thực hiện raycast để tìm điểm va chạm
        const results = PhysicsSystem2D.instance.raycast(
            this._cachedStartPoint,
            this._cachedEndPoint,
            ERaycast2DType.Closest // Chỉ lấy điểm gần nhất
        );

        let targetLineLength = maxLineLength;

        // Nếu có va chạm, tính độ dài tia đến điểm va chạm
        if (results && results.length > 0) {
            const closestHit = results[0];
            // Tính khoảng cách từ hand đến điểm va chạm
            const hitPoint = closestHit.point;
            targetLineLength = worldPos.y - hitPoint.y;
        }

        // Smoothing: làm mượt sự thay đổi độ dài tia
        const smoothFactor = 0.3; // Tốc độ làm mượt (0-1, càng cao càng nhanh)
        let lineLength: number;

        if (this._lastLineLength === 0) {
            lineLength = targetLineLength;
        } else {
            lineLength = this._lastLineLength + (targetLineLength - this._lastLineLength) * smoothFactor;
        }

        // Chỉ vẽ lại nếu có sự thay đổi đáng kể (>1 pixel)
        if (Math.abs(lineLength - this._lastLineLength) > 0.5) {
            this._graphics.clear();

            // Vẽ đường thẳng từ vị trí hiện tại xuống dưới (trong local space)
            this._graphics.moveTo(0, 0);
            this._graphics.lineTo(0, -lineLength);
            this._graphics.stroke();

            this._lastLineLength = lineLength;
        }
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

                // Hiện lại tia dọc
                this._showLine = true;
            }
        }
    }

    // Vẽ tia sau khi tất cả update hoàn tất để mượt hơn
    lateUpdate () {
        this.drawVerticalLine();
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

        // Ẩn tia dọc
        this._showLine = false;

        // Bắt đầu cooldown
        this._canSpawn = false;
        this._spawnCooldown = 0;

        // Chọn type tiếp theo từ unlocked items (hoặc mặc định 1, 2 nếu chưa unlock gì)
        this._nextItemType = this.getNextSpawnType();
    }

    /**
     * Lấy type tiếp theo để spawn
     * Ưu tiên random từ danh sách đã unlock, nếu chưa unlock gì thì dùng mặc định (1, 2)
     */
    private getNextSpawnType(): number {
        const achievementMgr = AchievementManager.instance;
        if (achievementMgr) {
            const unlockedTypes = achievementMgr.getUnlockedTypes();
            return ItemConfigHelper.getRandomSpawnableTypeFromUnlocked(unlockedTypes);
        }
        // Fallback về mặc định nếu không có AchievementManager
        return ItemConfigHelper.getRandomSpawnableType();
    }


    onDestroy () {
        input.off(Input.EventType.TOUCH_START, this.onTouch, this);
    }



}
