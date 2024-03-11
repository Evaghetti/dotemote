import {Transform, Vector} from "./vector";

export interface Frame {
    holdTime: number,
    x: number,
    y: number,
    w: number,
    h: number,
}

export interface SpriteAnimation {
    frames: Frame[],
}

export interface SpriteAnimationDataBase {
    [name: string]: SpriteAnimation
}

export class AnimationController {
    public currentTime: number = 0;
    public nameCurrentAnimation: string = "";
    private currentFrameIndex: number = 0;

    constructor(private animations: SpriteAnimationDataBase) {
    }

    public updateAnimation(deltaTime: number): void {
        const frame = this.currentFrame;

        this.currentTime += deltaTime;
        if (this.currentTime >= frame.holdTime) {
            const animation = this.currentAnimation;

            this.currentFrameIndex = (this.currentFrameIndex + 1) % animation.frames.length;
            this.currentTime = 0;
        }
    }

    public changeAnimation(newAnimation: string): void {
        if (this.nameCurrentAnimation.length > 0) {
            this.currentTime = 0;
            this.currentFrameIndex = 0;
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

        return currentAnimation.frames[this.currentFrameIndex];
    }

}
