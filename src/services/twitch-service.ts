import * as tmi from "tmi.js";

import { ChatterService } from "./chatter-service";

const CHANNEL = "vinidotruan";

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

interface Config {
  client_id: string,
  client_secret: string
}

export class TwitchService {
  private static emoteDatabase: EmoteDatabase = {};
  private client = new tmi.Client({});

  constructor(private fansService: ChatterService) {
    this.prepareLoader().then(() => this.prepareListener());
  }

  private async prepareLoader() {
    let config = await fetch("/config.json")
      .then((r) => r.json()) as Config;

    let requestAuth = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      body: `client_id=${config.client_id}&client_secret=${config.client_secret}&grant_type=client_credentials`,
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
        "Client-Id": `${config.client_id}`
      }
    })

    // TODO: Handle error
    let emotesData = await requestEmotes.json() as EmoteResponse;
    for (let emote of emotesData.data)
      TwitchService.emoteDatabase[emote.name] = emote.images;

    let loginRequest = await fetch(`https://api.twitch.tv/helix/users?login=${CHANNEL}`, {
      headers: {
        'Authorization': `Bearer ${authResponse.access_token}`,
        'Client-Id': `${config.client_id}`
      }

    });
    // TODO: Handle error
    let user_id: number = (await loginRequest.json()).data[0].id;
    let responseBttv = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${user_id}`)
      .then(response => response.json())
    // TODO: Handle channel emotes
    for (let emote of responseBttv.sharedEmotes) {
      const newEmote: EmoteData = {
        id: emote.id,
        name: emote.code,
        images: {
          url_1x: `https://cdn.betterttv.net/emote/${emote.id}/1x.webp`,
          url_2x: `https://cdn.betterttv.net/emote/${emote.id}/2x.webp`,
          url_4x: `https://cdn.betterttv.net/emote/${emote.id}/3x.webp`,
        }
      };

      TwitchService.emoteDatabase[newEmote.name] = newEmote.images;
    }
    console.log(responseBttv);
    console.log("Carregou");
  }

  private prepareListener() {
    this.client = new tmi.Client({
      channels: [CHANNEL]
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
