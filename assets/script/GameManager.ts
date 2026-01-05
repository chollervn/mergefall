import {
    _decorator,
    Component,
    Node,
    director,
    find,
    Button,
    BlockInputEvents,
} from 'cc';
import { ItemTouch } from './ItemTouch';
import { ITEM_CONFIG } from './ItemConfig';

const { ccclass, property } = _decorator;

/**
 * GameManager - Quản lý trạng thái game (thắng/thua, điểm số, restart)
 */
@ccclass('GameManager')
export class GameManager extends Component {

    // Singleton instance
    private static _instance: GameManager | null = null;
    public static get instance(): GameManager | null {
        return GameManager._instance;
    }

    @property(Node)
    itemContainer: Node = null!;  // Node chứa tất cả items (để kiểm tra thua)

    @property(Node)
    loseLineNode: Node = null!;  // Node đường giới hạn thua (items không được vượt qua)

    @property(Node)
    winPanel: Node = null!;  // Panel hiển thị khi thắng

    @property(Node)
    losePanel: Node = null!;  // Panel hiển thị khi thua

    // Trạng thái game
    private _isGameOver: boolean = false;
    private _maxItemType: number = 0;  // Lấy từ config

    // Thời gian delay trước khi bắt đầu kiểm tra thua (tránh thua ngay khi spawn item đầu tiên)
    private static readonly LOSE_CHECK_DELAY = 2.0;  // 2 giây delay ban đầu

    // Interval kiểm tra thua
    private static readonly LOSE_CHECK_INTERVAL = 0.1;  // Kiểm tra mỗi 0.1 giây (nhanh hơn)

    // Panel hiện tại đang hiển thị
    private _activePanel: Node | null = null;

    onLoad() {
        // Set singleton
        if (GameManager._instance === null) {
            GameManager._instance = this;
        } else {
            this.destroy();
            return;
        }

        // Tìm max item type từ config (item có nextType = 0)
        const maxItem = ITEM_CONFIG.find(item => item.nextType === 0);
        this._maxItemType = maxItem ? maxItem.type : 7;

        // ========== TỰ ĐỘNG TÌM CÁC NODE ==========

        // Tự động tìm Canvas làm itemContainer (nơi chứa items)
        if (!this.itemContainer) {
            this.itemContainer = find('Canvas');
            if (this.itemContainer) {
                console.log('✓ itemContainer auto-found: Canvas');
            }
        }
    }

    start() {
        console.log('🎮 GameManager START called!');

        // Ẩn panels khi bắt đầu và setup buttons
        if (this.winPanel) {
            this.winPanel.active = false;
            this.setupPanel(this.winPanel);
        }
        if (this.losePanel) {
            this.losePanel.active = false;
            this.setupPanel(this.losePanel);
        }

        // Debug log
        if (this.loseLineNode) {
            console.log('✓ LoseLine world Y:', this.loseLineNode.worldPosition.y);
        } else {
            console.error('❌ loseLineNode is NOT assigned!');
        }
        if (this.itemContainer) {
            console.log('✓ itemContainer:', this.itemContainer.name, 'children count:', this.itemContainer.children.length);
        } else {
            console.error('❌ itemContainer is NOT assigned!');
        }

        // Reset game over state
        this._isGameOver = false;
        this._activePanel = null;

        // Bắt đầu kiểm tra điều kiện thua
        this.schedule(this.checkLoseCondition, GameManager.LOSE_CHECK_INTERVAL, undefined, GameManager.LOSE_CHECK_DELAY);
        console.log(`📅 Scheduled lose check every ${GameManager.LOSE_CHECK_INTERVAL}s, delay ${GameManager.LOSE_CHECK_DELAY}s`);
    }

    /**
     * Setup panel - thêm BlockInputEvents và kết nối nút Restart
     */
    setupPanel(panel: Node) {
        // Thêm BlockInputEvents nếu chưa có (chặn click xuyên qua panel)
        if (!panel.getComponent(BlockInputEvents)) {
            panel.addComponent(BlockInputEvents);
            console.log('✓ Added BlockInputEvents to', panel.name);
        }

        // Tìm và kết nối nút Restart
        const possibleButtonNames = ['RestartButton', 'Restart', 'restart', 'PlayAgain', 'Retry', 'retry'];
        for (const name of possibleButtonNames) {
            const buttonNode = panel.getChildByName(name);
            if (buttonNode) {
                const button = buttonNode.getComponent(Button);
                if (button) {
                    // Xóa event cũ (nếu có) và thêm event mới
                    buttonNode.off(Button.EventType.CLICK);
                    buttonNode.on(Button.EventType.CLICK, this.restartGame, this);
                    console.log('✓ Connected restart button:', name);
                    return;
                }
            }
        }

        // Tìm button trong children sâu hơn
        panel.children.forEach(child => {
            const button = child.getComponent(Button);
            if (button) {
                child.off(Button.EventType.CLICK);
                child.on(Button.EventType.CLICK, this.restartGame, this);
                console.log('✓ Connected restart button:', child.name);
            }
        });
    }

    /**
     * Kiểm tra điều kiện thua - item chạm vào đường giới hạn là thua
     */
    checkLoseCondition() {
        if (this._isGameOver) return;
        if (!this.itemContainer || !this.loseLineNode) {
            console.warn('GameManager: itemContainer or loseLineNode is null');
            return;
        }

        // Lấy world position Y của đường giới hạn
        const loseLineWorldY = this.loseLineNode.worldPosition.y;

        // Duyệt tất cả children trong container để tìm items
        for (const child of this.itemContainer.children) {
            const itemTouch = child.getComponent(ItemTouch);
            if (!itemTouch) continue;

            // Bỏ qua item mới spawn (đang trong thời gian miễn nhiễm)
            if (itemTouch.isImmune()) {
                continue;
            }

            // Lấy world position Y của item
            const itemWorldY = child.worldPosition.y;

            // Nếu item vượt qua đường giới hạn (phía trên)
            if (itemWorldY > loseLineWorldY) {
                // THUA NGAY! (item đã qua thời gian miễn nhiễm mà vẫn ở trên vạch)
                console.log(`💀 Item touched lose line! Y=${itemWorldY.toFixed(0)} > LineY=${loseLineWorldY.toFixed(0)}`);
                this.onGameLose();
                return;
            }
        }
    }

    /**
     * Kiểm tra điều kiện thắng - được gọi khi merge thành công
     * @param newItemType Type của item vừa được tạo từ merge
     */
    checkWinCondition(newItemType: number) {
        if (this._isGameOver) return;

        // Kiểm tra đã đạt max level chưa
        if (newItemType >= this._maxItemType) {
            console.log('Max level reached! You WIN!');
            this.onGameWin();
        }
    }


    /**
     * Xử lý khi thắng game
     */
    onGameWin() {
        if (this._isGameOver) return;

        this._isGameOver = true;
        this.unschedule(this.checkLoseCondition);

        console.log('========================================');
        console.log('🎉🎉🎉 YOU WIN! 🎉🎉🎉');
        console.log('========================================');


        // Hiển thị win panel
        if (this.winPanel) {
            // Di chuyển panel về giữa màn hình
            this.winPanel.setPosition(0, 0, 0);
            this.winPanel.active = true;
            // Đưa panel lên trên cùng (render cuối cùng = hiển thị trên cùng)
            this.winPanel.setSiblingIndex(this.winPanel.parent!.children.length - 1);
            this._activePanel = this.winPanel;
            console.log('Win Panel displayed!');
        } else {
            console.log('No Win Panel to display');
        }

        // Pause physics (optional)
        // director.pause();
    }

    /**
     * Xử lý khi thua game
     */
    onGameLose() {
        if (this._isGameOver) return;

        this._isGameOver = true;
        this.unschedule(this.checkLoseCondition);

        console.log('========================================');
        console.log('💀💀💀 GAME OVER 💀💀💀');
        console.log('========================================');


        // Hiển thị lose panel
        if (this.losePanel) {
            // Di chuyển panel về giữa màn hình
            this.losePanel.setPosition(0, 0, 0);
            this.losePanel.active = true;
            // Đưa panel lên trên cùng (render cuối cùng = hiển thị trên cùng)
            this.losePanel.setSiblingIndex(this.losePanel.parent!.children.length - 1);
            this._activePanel = this.losePanel;
            console.log('Lose Panel displayed!');
        } else {
            console.log('No Lose Panel to display');
        }

        // Pause physics (optional)
        // director.pause();
    }

    /**
     * Restart game - được gọi từ Button Click Event
     */
    public restartGame() {
        console.log('🔄 Restarting game...');

        // Ngăn click nhiều lần
        if (this._activePanel) {
            this._activePanel.active = false;
            this._activePanel = null;
        }

        // Reset singleton trước khi load lại scene
        GameManager._instance = null;

        // Resume game nếu đang pause
        director.resume();

        // Load lại scene
        director.loadScene('scene');
    }

    /**
     * Getter cho trạng thái game
     */
    get isGameOver(): boolean {
        return this._isGameOver;
    }


    onDestroy() {
        if (GameManager._instance === this) {
            GameManager._instance = null;
        }
        this.unschedule(this.checkLoseCondition);
    }

    /**
     * Đảm bảo panel luôn ở trên cùng mỗi frame (khi game over)
     */
    lateUpdate() {
        if (this._activePanel && this._activePanel.active && this._activePanel.parent) {
            const maxIndex = this._activePanel.parent.children.length - 1;
            if (this._activePanel.getSiblingIndex() < maxIndex) {
                this._activePanel.setSiblingIndex(maxIndex);
            }
        }
    }
}


