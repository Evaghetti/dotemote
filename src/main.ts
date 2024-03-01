const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

if (ctx === null)
    throw "Foda";

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

let sprites: Sprite[] = [];

for (let i = 0; i < 5; i++) {
    let sprite = new Sprite(
        "img/sheet.png",
        {
            position: new Vector(Math.random() * window.innerWidth, window.innerHeight / 2),
            size: new Vector(64, 64),
        },
        new AnimationController(spriteAnimations)
    );

    sprite.currentAnimaion = "andando";

    sprites.push(sprite);
}


// Main Loop
let tempoAntigo = Date.now();
setInterval(() => {
    let tempoAtual = Date.now();
    let deltaTime = (tempoAtual - tempoAntigo) / 1000;
    tempoAntigo = tempoAtual;

    // Update Sprites
    for (let sprite of sprites)
        sprite.update(deltaTime);

    // Draw Everything
    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    ctx.fillStyle = "green";
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

    for (let sprite of sprites)
        sprite.draw(ctx);
}, 1 / 60);
