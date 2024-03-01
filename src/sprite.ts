const VELOCITY = new Vector(50, 0);

class Sprite {
    private image: HTMLImageElement;
    private flipped: boolean = false;

    constructor(path: string, private transform: Transform, private animationController: AnimationController) {
        this.image = new Image();
        this.image.src = path;
    }

    public set currentAnimaion(newAnimation: string) {
        this.animationController.changeAnimation(newAnimation);
    }

    public flip(): void {
        this.flipped = !this.flipped;
    }

    public update(deltaTime: number): void {
        this.animationController.updateAnimation(deltaTime);

        let velocity = VELOCITY.multiplyScalar(deltaTime);
        if (this.flipped)
            velocity.x *= -1;

        this.transform.position = this.transform.position.add(velocity);

        if (Math.random() >= 0.99)
            this.flip();
    }

    public draw(ctx: CanvasRenderingContext2D): void {
        const currentSprite = this.animationController.clip;

        if (this.flipped) {
            ctx.translate(this.transform.size.x, 0);
            ctx.scale(-1, 1);
        }

        ctx.drawImage(
            this.image,
            currentSprite.position.x,
            currentSprite.position.y,
            currentSprite.size.x,
            currentSprite.size.y,
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

