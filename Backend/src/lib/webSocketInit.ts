import { WebSocketServer } from "ws";
import http from "http";

export class Init {
  private static server: http.Server;
  public static Instance: Init;

  private io: WebSocketServer; // As it is private we can't use it outside the class, either make it public or use getter function
  private constructor(server: http.Server) {
    this.io = new WebSocketServer({
      server,
    });
  }

  // This is only for creating the instance of socket with condition
  // for getting io we need to use getter method
  public static getInstanceWs(server?: http.Server): Init {
    if (Init.Instance) {
      return Init.Instance;
    }
    if (!server) {
      throw new Error("server is not define");
    }

    this.Instance = new Init(server);

    return Init.Instance;
  }

  // So we have to create getter method
  public get connection() {
    return this.io;
  }
}
