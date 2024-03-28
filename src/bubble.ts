import { Vector } from "./vector";

export class SpeechBubble {
  private element: HTMLElement;
  private kill: boolean = false;
  private contentSize = 0;

  constructor(
    content: string,
    private track: Vector,
    private offset: Vector
  ) {
    this.element = document.createElement("div");
    this.contentSize = content.length;
    this.element.classList.add("bubble", this.getContentSize(), "bottom");
    this.element.innerText = content;
    this.element.style.opacity = "1";

    document.getElementsByTagName("body")[0].appendChild(this.element);
    this.offset.inplaceAdd(new Vector(0, -this.size.y));
    this.updatePosition();

    setTimeout(() => {
      let interval = setInterval(() => {
        let currentOpacity = this.opacity - 0.1;
        this.element.style.opacity = `${currentOpacity}`;

        if (this.shouldStartFading) {
          this.kill = true;
          clearInterval(interval);
        }
      }, 50);
    }, 5000);
  }

  public updatePosition(): void {
    const actualPosition = this.track.add(this.offset);
    actualPosition.x -= this.size.x / 4;

    this.element.style.left = `${actualPosition.x}px`;
    this.element.style.top = `${actualPosition.y}px`;
  }

  public addOffset(offset: Vector): void {
    this.offset.inplaceAdd(offset);
  }

  public deleteElement(): void {
    this.element.remove();
  }

  public get size(): Vector {
    return new Vector(this.element.offsetWidth, this.element.offsetHeight);
  }

  public get layer(): number {
    const index = parseInt(this.element.style.zIndex) || 0;

    return index;
  }

  private get opacity(): number {
    let opacity = parseFloat(this.element.style.opacity);

    if (isNaN(opacity)) opacity = 1;
    return opacity;
  }

  public get shouldKill(): boolean {
    return this.kill;
  }

  private get shouldStartFading(): boolean {
    const opacity = this.opacity;

    return opacity <= 0;
  }

  public set layer(newLayer: number) {
    this.element.style.zIndex = `${newLayer}`;
  }

  private getContentSize() {
    if (this.contentSize < 20) {
      return "small";
    } else if (this.contentSize < 40) {
      return "medium";
    } else {
      return "large";
    }
  }

  public get padding(): number {
    const cssObject = getComputedStyle(this.element);
    let paddingValue = cssObject.getPropertyValue("padding").match(/\d+/);

    if (paddingValue === null)
      return 0;
    return parseInt(paddingValue[0]);
  }
}
