import {Frame, SpriteAnimationDataBase} from "./animation";

export interface JsonAnimation {
  name: string,
  frames: Frame[]
}

export interface JsonSprite {
  path: string,
  animations: JsonAnimation[]
}

export class SpriteInfoLoader {
  private pathes: string[] = [];
  private animationDatabases: SpriteAnimationDataBase[] = [];
  private currentIndex: number = 0;

  public async load() {
    await fetch("/database.json")
      .then(r => r.json())
      .then(r => {
        let jsonData: JsonSprite[] = r.sprites;

        for (let json of jsonData) {
          this.pathes.push(json.path);

          let database: SpriteAnimationDataBase = {};
          for (let animation of json.animations) {
            database[animation.name] = {frames: []};
            database[animation.name].frames = animation.frames;
          }

          this.animationDatabases.push(database);
        }

        console.log(this.pathes, this.animationDatabases);
      });
  }

  public get path(): string {
    return this.pathes[this.currentIndex];
  }

  public get animationDatabase(): SpriteAnimationDataBase {
    return this.animationDatabases[this.currentIndex];
  }
}
