import * as tmi from "tmi.js";

import { ChatterService } from "./chatter-service";

const CLIENT_ID = "REDACTED";
const CLIENT_SECRET = "REDACTED";

interface AuthResponse {
  access_token: string,
  expires_in: number,
  token_type: string
}

interface Emote {
  name: string,
  images: string[],
  scale: string
}

interface EmoteResponse {
  data: Emote[],
  template: string
}

interface EmoteDatabase {
  [name: string]: Emote;
}

export class TwitchService {
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
    console.log(emotesData.template);
    for (let emote of emotesData.data) {
      console.log(emote.name, emote.images, emote.scale);
    }
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

  fans() {
    return this.fansService.chatters;
  }
}
