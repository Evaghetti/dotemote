import {DotFan} from "../dotfan";
import {Sprite} from "../sprite";
import {Vector} from "../vector";
import {AnimationController} from "../animation";
import {SpriteInfoLoader} from "../load-data";

export class ChatterService {
  private _chatters: DotFan[] = [];
  private loadedData = new SpriteInfoLoader();

  constructor() {
    this.loadedData.load().then();
  }

  public addChatter(id: string) {

    this._chatters.push(new DotFan(
      new Sprite(
        this.loadedData.path,
        {
          position: new Vector(0, 10),
          size: new Vector(64, 64)
        }
      ),
      new AnimationController(this.loadedData.animationDatabase),
      id
    ))
  }

  get chatters() {
    return this._chatters;
  }
}