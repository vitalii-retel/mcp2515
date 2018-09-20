Plain CAN BUS scanner.

Install mcp2515 library from https://github.com/coryjfowler/MCP_CAN_lib to your Arduino IDE.

If you have edited `http-client` run `node generate-http-client-files.ts` to update esp8266 sketch.

* Check if LOOPBACK_MODE mode is turned off (server.ino).

Compile and Upload to esp8266.

Connect to WIFI `MCP2515` password `12345678`.

Open http://192.168.1.1 web page.
