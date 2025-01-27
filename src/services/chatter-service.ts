import { DotFan } from "../dotfan";
import { Sprite } from "../sprite";
import { Vector } from "../vector";
import { AnimationController } from "../animation";
import { SpriteInfoLoader } from "../load-data";

interface ChatterDatabase {
  [id: string]: DotFan;
}

export class ChatterService {
  private _chatters: ChatterDatabase = {};
  private loadedData = new SpriteInfoLoader();

  constructor() {
    this.loadedData.load().then();
  }

  public addChatter(id: string, sprite: number = 0) {
    let newChatter = new DotFan(
      new Sprite(this.loadedData.getPath(sprite), {
        position: new Vector(0, 10),
        size: new Vector(64, 64)
      }),
      new AnimationController(this.loadedData.getAnimationDatabase(sprite)),
    );
    this._chatters[id] = newChatter;
  }

  get chatters() {
    return Object.values(this._chatters);
  }

  hasChatter(id: string): boolean {
    return !!this._chatters[id];
  }

  chatter(id: string): DotFan {
    return this._chatters[id];
  }

  deleteChatter(id: string) {
    delete this._chatters[id];
  }
}
