import { SpriteInfoLoader } from "./load-data";
import { ChatterService } from "./services/chatter-service";
import { TwitchService } from "./services/twitch-service";

export class Main {
  private canvas = document.getElementById("canvas") as HTMLCanvasElement;
  private ctx = this.canvas.getContext("2d");
  private twitchService = new TwitchService(new ChatterService());

  public main() {
    if (!this.ctx) throw "Bro wtf";
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx.imageSmoothingEnabled = false;
  }

  setUp() { }

  render() {
    let tempoAntigo = Date.now();
    setInterval(() => {
      let tempoAtual = Date.now();
      let deltaTime = (tempoAtual - tempoAntigo) / 1000;
      tempoAntigo = tempoAtual;

      // Update Sprites
      for (let fan of this.twitchService.fans()) fan.update(deltaTime);

      if (this.ctx) {
        // Draw Everything
        this.ctx.clearRect(
          0,
          0,
          this.canvas.offsetWidth,
          this.canvas.offsetHeight,
        );
        for (let fan of this.twitchService.fans()) fan.draw(this.ctx);
      }
    }, 1 / 60);
  }
}

const render = new Main();
render.main();
render.render();
