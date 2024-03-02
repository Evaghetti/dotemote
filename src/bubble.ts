class SpeechBubble {
    private element: HTMLElement;
    private kill: boolean = false;

    constructor(
        content: string,
        private track: Vector,
        private offset: Vector,
    ) {
        this.element = document.createElement("div");

        this.element.classList.add("bubble", "medium", "bottom");
        this.element.innerText = content;
        this.element.style.opacity = "1";
        this.updatePosition();

        document.getElementsByTagName("body")[0].appendChild(this.element);

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

        if (isNaN(opacity))
            opacity = 1;
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
}
