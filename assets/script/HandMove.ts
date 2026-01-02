import {
    _decorator,
    Component,
    Sprite,
    SpriteFrame,
    input,
    Input,
    EventTouch,
    Prefab,
    instantiate,

} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('handmove')
export class handmove extends Component {

    @property(SpriteFrame)
    hand1Sprite: SpriteFrame = null!;

    @property(SpriteFrame)
    hand2Sprite: SpriteFrame = null!;

    @property
    speed: number = 200;

    @property
    moveRange: number = 250;

    @property(Prefab)
    item : Prefab = null;


    private _dir = 1;
    private _startX = 0;
    private _sprite: Sprite = null!;

    // --- click state ---
    private _showHand1 = false;
    private _timer = 0;
    private readonly SHOW_TIME = 0.36; // 1 giây

    start () {
        this._sprite = this.getComponent(Sprite)!; this._sprite.node.setPosition(0,250,0)
        this._startX = this.node.position.x;

        // đảm bảo ảnh ban đầu là hand2
        this._sprite.spriteFrame = this.hand2Sprite;

        input.on(Input.EventType.TOUCH_START, this.onTouch, this);
    }

    update (dt: number) {
        // --- di chuyển ngang ---
        const pos = this.node.position.clone();
        pos.x += this.speed * this._dir * dt;

        if (Math.abs(pos.x - this._startX) > this.moveRange) {
            this._dir *= -1;
        }
        this.node.setPosition(pos);

        // --- đếm thời gian đổi lại hand2 ---
        if (this._showHand1) {
            this._timer += dt;
            if (this._timer >= this.SHOW_TIME) {
                this._showHand1 = false;
                this._sprite.spriteFrame = this.hand2Sprite;
            }
        }
    }

    onTouch () {
        this._sprite.spriteFrame = this.hand1Sprite;

        if (this.item) {
            const obj = instantiate(this.item);

            this.node.parent!.addChild(obj);

            const wp = this.node.worldPosition;
            obj.setWorldPosition(wp.x, wp.y, wp.z);
        }

        this._showHand1 = true;
        this._timer = 0;
    }


    onDestroy () {
        input.off(Input.EventType.TOUCH_START, this.onTouch, this);
    }



}
