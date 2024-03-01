class SpeechBubble {
    private element: HTMLElement;

    constructor(
        content: string,
        private track: Vector,
        private offset: Vector,
    ) {
        this.element = document.createElement("div");

        this.element.classList.add("bubble", "medium", "bottom");
        this.element.innerText = content;
        this.updatePosition();

        document.getElementsByTagName("body")[0].appendChild(this.element);
    }

    public updatePosition(): void {
        const actualPosition = this.track.add(this.offset);
        actualPosition.x -= this.size.x / 4;

        this.element.style.left = `${actualPosition.x}px`;
        this.element.style.top = `${actualPosition.y}px`;
    }

    public get size(): Vector {
        return new Vector(this.element.offsetWidth, this.element.offsetHeight);
    }

    public get layer(): number {
        const index = parseInt(this.element.style.zIndex) || 0;

        return index;
    }

    public set layer(newLayer: number) {
        this.element.style.zIndex = `${newLayer}`;
    }
}
