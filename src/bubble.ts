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

        this.element.style.left = `${actualPosition.x}px`;
        this.element.style.top = `${actualPosition.y}px`;

    }
}
