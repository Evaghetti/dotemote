import * as tmi from "tmi.js";

import { ChatterService } from "./chatter-service";

const CLIENT_ID = "REDACTED";
const CLIENT_SECRET = "REDACTED";

interface AuthResponse {
  access_token: string,
  expires_in: number,
  token_type: string
}

export interface EmoteImage {
  url_1x: string,
  url_2x: string,
  url_4x: string,
}

interface EmoteData {
  id: string,
  name: string,
  images: EmoteImage,
}

interface EmoteResponse {
  data: EmoteData[],
  template: string
}

interface ExchangeSizeUrl {
  [name: string]: string;
}

export interface EmoteDatabase {
  [name: string]: EmoteImage;
}

export class TwitchService {
  private static emoteDatabase: EmoteDatabase = {};
  private client = new tmi.Client({});

  constructor(private fansService: ChatterService) {
    this.prepareLoader().then(() => this.prepareListener());
  }

  private async prepareLoader() {
    let requestAuth = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      body: `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    // TODO: Handle error

    let authResponse = await requestAuth.json() as AuthResponse;

    let requestEmotes = await fetch("https://api.twitch.tv/helix/chat/emotes/global", {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Bearer ${authResponse.access_token}`,
        "Client-Id": `${CLIENT_ID}`
      }
    })

    // TODO: Handle error
    let emotesData = await requestEmotes.json() as EmoteResponse;
    for (let emote of emotesData.data)
      TwitchService.emoteDatabase[emote.name] = emote.images;
    console.log("Carregou");
  }

  private prepareListener() {
    this.client = new tmi.Client({
      channels: ["vinidotruan"]
    });

    this.client.connect();

    this.client.on(
      "message",
      (_channel: any, tags: any, message: any, _self: boolean) => {
        const chatter = tags["display-name"];

        if (!this.fansService.hasChatter(chatter)) {
          this.fansService.addChatter(chatter);
        }

        let fan = this.fansService.chatter(chatter);
        fan.addMessage(message);
      }
    );
  }

  static getUrlBySize(size: string, emote: EmoteImage): string {
    size = "small"; // TODO: Validar melhor a questão dos botões invés de hard codar isso
    const options: ExchangeSizeUrl = {
      "small": emote.url_1x,
      "medium": emote.url_2x,
      "large": emote.url_4x,
    };

    return options[size];
  }

  fans() {
    return this.fansService.chatters;
  }

  static get emotes(): EmoteDatabase {
    return TwitchService.emoteDatabase;
  }
}
