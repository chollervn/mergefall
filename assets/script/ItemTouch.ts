import {
    _decorator,
    Component,
    Collider2D,
    IPhysics2DContact,
    Prefab,
    instantiate,
    Vec3
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('Item')
export class Item extends Component {

    @property
    itemType: number = 0;

    @property([Prefab])
    itemPrefabs: Prefab[] = [];

    /* =========================
       PHYSICS2D AUTO CALLBACK
       ========================= */
    onBeginContact(
        selfCollider: Collider2D,
        otherCollider: Collider2D,
        contact: IPhysics2DContact | null
    ) {
        const otherItem = otherCollider.node.getComponent(Item);
        if (!otherItem) return;

        // tránh merge 2 lần
        if (!this.node.isValid || !otherItem.node.isValid) return;

        // chỉ merge khi giống nhau
        if (this.itemType === otherItem.itemType) {
            this.merge(otherItem);
        }
    }

    merge(otherItem: Item) {
        const pos = this.node.worldPosition.clone()
            .add(otherItem.node.worldPosition)
            .multiplyScalar(0.5);

        this.node.destroy();
        otherItem.node.destroy();

        this.spawnRandomItem(pos);
    }

    spawnRandomItem(position: Vec3) {
        if (this.itemPrefabs.length === 0) return;

        const index = Math.floor(Math.random() * this.itemPrefabs.length);
        const newItem = instantiate(this.itemPrefabs[index]);

        newItem.setWorldPosition(position);
        this.node.parent?.addChild(newItem);
    }
}
