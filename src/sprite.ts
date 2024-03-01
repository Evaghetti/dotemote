
class Sprite {
    private image: HTMLImageElement;
    private flipped: boolean = false;
    private currentClip: Transform;

    constructor(path: string, private transform: Transform) {
        this.image = new Image();
        this.image.src = path;
        this.currentClip = {
            position: new Vector(0, 0),
            size: new Vector(this.image.width, this.image.height)
        };
    }

    public flip(): void {
        this.flipped = !this.flipped;
    }

    public set clip(newClip: Transform) {
        this.currentClip = newClip;
    }

    public set position(newPosition: Vector) {
        this.transform.position.x = newPosition.x;
        this.transform.position.y = newPosition.y;
    }

    public get size(): Vector {
        return this.transform.size;
    }

    public draw(ctx: CanvasRenderingContext2D): void {
        if (this.flipped) {
            ctx.translate(this.transform.size.x, 0);
            ctx.scale(-1, 1);
        }

        ctx.drawImage(
            this.image,
            this.currentClip.position.x,
            this.currentClip.position.y,
            this.currentClip.size.x,
            this.currentClip.size.y,
            (this.flipped) ? -this.transform.position.x : this.transform.position.x,
            this.transform.position.y,
            this.transform.size.x,
            this.transform.size.y
        );

        if (this.flipped) {
            ctx.translate(this.transform.size.x, 0);
            ctx.scale(-1, 1);
        }
    }
}

