import * as tmi from "tmi.js";
import {ChatterService} from "./chatter-service";

export class TwitchService {
  private client = new tmi.Client({});
  private chatters: string[] = [];

  constructor(private fansService: ChatterService) {
    this.client = new tmi.Client({
      channels: ['vinidotruan']
    });

    this.client.connect();

    this.client.on('message', (channel: any, tags: any, message: any, self: boolean) => {
      const chatter = tags['display-name'];
      if (this.chatters.filter((c: string) => c === chatter).length === 0) {
        this.chatters.push(chatter);
        this.fansService.addChatter(chatter);
      }

      console.log(`${tags['display-name']}: ${message}`);
    });
  }

  fans() {
    return this.fansService.chatters
  }
}