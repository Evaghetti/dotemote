interface JsonAnimation {
    name: string,
    frames: Frame[]
}

interface JsonSprite {
    path: string,
    animations: JsonAnimation[]
}

class SpriteInfoLoader {
    private pathes: string[] = [];
    private animationDatabases: SpriteAnimationDataBase[] = [];
    private currentIndex: number = 0;

    public async load() {
        await fetch("./database.json")
            .then(r => r.json())
            .then(r => {
                let jsonData: JsonSprite[] = r.sprites;

                for (let json of jsonData) {
                    console.log(json);

                    this.pathes.push(json.path);

                    let database: SpriteAnimationDataBase = {};
                    for (let teste of json.animations) {
                        database[teste.name] = { frames: [] };
                        database[teste.name].frames = teste.frames;
                    }

                    this.animationDatabases.push(database);
                }

                console.log(this.pathes, this.animationDatabases);
            });
    }

    private getRandomNumber(max: number) {
        return Math.floor(Math.random() * max);
    }

    public selectRandomSprite(): void {
        this.currentIndex = this.getRandomNumber(this.pathes.length);
    }

    public get path(): string {
        return this.pathes[this.currentIndex];
    }

    public get animationDatabase(): SpriteAnimationDataBase {
        return this.animationDatabases[this.currentIndex];
    }
}
