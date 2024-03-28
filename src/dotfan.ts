import { AnimationController } from "./animation";
import { SpeechBubble } from "./bubble";
import { Vector } from "./vector";
import { Sprite } from "./sprite";

const VELOCITY = new Vector(50, 0);

export class DotFan {
  private bubbles: SpeechBubble[] = [];
  private position: Vector;
  private flipped: boolean;

  constructor(
    private sprite: Sprite,
    private animationController: AnimationController,
  ) {
    this.position = new Vector(
      window.innerWidth * Math.random(),
      window.innerHeight - this.sprite.size.y
    );

    this.animationController.changeAnimation("andando"); // TODO: mudar isso pra caso tenha mais de uma animação

    this.flipped = Math.random() >= 0.5;
    if (this.flipped) this.sprite.flip();
  }

  public addMessage(content: string): void {
    let offset = new Vector(0, -this.sprite.size.y);
    let newBubble = new SpeechBubble(content, this.position, offset);

    for (let bubble of this.bubbles) {
      offset.y += -bubble.size.y;
      bubble.layer = bubble.layer + 1;
    }

    this.bubbles.push(newBubble);
  }

  public update(deltaTime: number): void {
    this.animationController.updateAnimation(deltaTime);

    if (this.position.x < 0) {
      this.position.x = 0;
      this.sprite.flip();
      this.flipped = !this.flipped;
    } else if (this.position.x + this.sprite.size.x > window.innerWidth) {
      this.position.x = window.innerWidth - this.sprite.size.x;
      this.sprite.flip();
      this.flipped = !this.flipped;
    }

    let actualVelocity = VELOCITY.multiplyScalar(deltaTime);
    if (this.flipped) actualVelocity.inplaceMultiplyScalar(-1);
    this.position.inplaceAdd(actualVelocity);

    this.sprite.clip = this.animationController.clip;
    this.sprite.position = this.position;

    for (let i = 0; i < this.bubbles.length; i++) {
      const bubble = this.bubbles[i];

      bubble.updatePosition();
      if (bubble.shouldKill) {
        for (let j = i + 1; j < this.bubbles.length; j++) {
          const updatingBubble = this.bubbles[j];

          updatingBubble.addOffset(new Vector(0, bubble.size.y));
        }

        bubble.deleteElement();
        this.bubbles.splice(i, 1);
        i--;
      }
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    this.sprite.draw(ctx);
  }

}

export interface AvatarDatabase {
  [id: string]: DotFan;
}
