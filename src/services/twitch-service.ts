import * as tmi from "tmi.js";
import { ChatterService } from "./chatter-service";

export class TwitchService {
  private client = new tmi.Client({});

  constructor(private fansService: ChatterService) {
    this.client = new tmi.Client({
      channels: ["vinidotruan"]
    });

    this.client.connect();

    this.client.on(
      "message",
      (channel: any, tags: any, message: any, self: boolean) => {
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
