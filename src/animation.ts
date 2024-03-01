interface Frame {
    holdTime: number,
    x: number,
    y: number,
    w: number,
    h: number,
}

interface SpriteAnimation {
    frames: Frame[],
    currentFrame: number
}

interface SpriteAnimationDataBase {
    [name: string]: SpriteAnimation
}

class AnimationController {
    public currentTime: number = 0;
    public nameCurrentAnimation: string = "";

    constructor(private animations: SpriteAnimationDataBase) {
    }

    public updateAnimation(deltaTime: number): void {
        const frame = this.currentFrame;

        this.currentTime += deltaTime;
        if (this.currentTime >= frame.holdTime) {
            const animation = this.currentAnimation;

            animation.currentFrame = (animation.currentFrame + 1) % animation.frames.length;
            this.currentTime = 0;
        }
    }

    public changeAnimation(newAnimation: string): void {
        if (this.nameCurrentAnimation.length > 0) {
            this.currentTime = 0;
            this.currentAnimation.currentFrame = 0;
        }

        this.nameCurrentAnimation = newAnimation;
    }

    public get clip(): Transform {
        const frame = this.currentFrame;

        return {
            position: new Vector(frame.x, frame.y),
            size: new Vector(frame.w, frame.h),
        }
    }

    public get currentAnimation(): SpriteAnimation {
        return this.animations[this.nameCurrentAnimation];
    }

    public get currentFrame(): Frame {
        const currentAnimation = this.currentAnimation;

        return currentAnimation.frames[currentAnimation.currentFrame];
    }

}
