
const loadedData = new SpriteInfoLoader();
loadedData.load().then(() => {

    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");

    if (ctx === null)
        throw "Foda";

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.imageSmoothingEnabled = false;

    loadedData.selectRandomSprite();

    let avatar = new DotFan(
        new Sprite(
            loadedData.path,
            {
                position: new Vector(0, 0),
                size: new Vector(64, 64)
            }
        ),
        new AnimationController(loadedData.animationDatabase)
    );

    // Main Loop
    let tempoAntigo = Date.now();
    setInterval(() => {
        let tempoAtual = Date.now();
        let deltaTime = (tempoAtual - tempoAntigo) / 1000;
        tempoAntigo = tempoAtual;

        // Update Sprites
        avatar.update(deltaTime);

        // Draw Everything
        ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
        avatar.draw(ctx);
    }, 1 / 60);

    document.querySelector("#falar")?.addEventListener("click", () => {
        avatar.addMessage("Mensagem de texto testavel testada");
    });
});
