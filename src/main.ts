const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");


if (ctx === null)
    throw "Foda";

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
ctx.imageSmoothingEnabled = false;

let spriteAnimations: SpriteAnimationDataBase = {};

spriteAnimations["andando"] = {
    currentFrame: 0,
    frames: [
        {
            holdTime: 0.15,
            x: 0,
            y: 0,
            w: 32,
            h: 32,
        },
        {
            holdTime: 0.15,
            x: 32,
            y: 0,
            w: 32,
            h: 32,
        },
        {
            holdTime: 0.15,
            x: 64,
            y: 0,
            w: 32,
            h: 32,
        },
        {
            holdTime: 0.15,
            x: 96,
            y: 0,
            w: 32,
            h: 32,
        },
        {
            holdTime: 0.15,
            x: 128,
            y: 0,
            w: 32,
            h: 32,
        },
        {
            holdTime: 0.15,
            x: 160,
            y: 0,
            w: 32,
            h: 32,
        },
        {
            holdTime: 0.15,
            x: 192,
            y: 0,
            w: 32,
            h: 32,
        },
        {
            holdTime: 0.15,
            x: 224,
            y: 0,
            w: 32,
            h: 32,
        },
    ]
};

let avatar = new DotFan(
    new Sprite(
        "img/sheet.png",
        {
            position: new Vector(0, 0),
            size: new Vector(64, 64)
        }
    ),
    new AnimationController(spriteAnimations)
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
