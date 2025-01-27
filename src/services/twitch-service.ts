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

        if (message == "!cap") {
          this.fansService.deleteChatter(chatter);
          this.fansService.addChatter(chatter, 1);
          fan = this.fansService.chatter(chatter);
          return;
        }

        if (message == "!viking") {
          this.fansService.deleteChatter(chatter);
          this.fansService.addChatter(chatter, 0);
          fan = this.fansService.chatter(chatter);
          return;
        }

        fan.addMessage(message);
      }
    );
  }

  fans() {
    return this.fansService.chatters;
  }
}
