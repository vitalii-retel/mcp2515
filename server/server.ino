#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include <ESP8266WebServer.h>
#include <mcp_can.h>
#include <SPI.h>


/******************************/
/****  WIFI  ******************/
/******************************/
// SSID and Password
const char* ssid = "MCP2515";
const char* password = "12345678";

IPAddress local_IP(192, 168, 1, 1);
IPAddress gateway(192, 168, 1, 100);
IPAddress subnet(255, 255, 255, 0);

void wifiSetup() {
    Serial.print(F("Wi-Fi mode set to WIFI_AP ... "));
    Serial.println(WiFi.mode(WIFI_AP) ? F("Ready") : F("Failed!"));

    Serial.print(F("Setting soft-AP configuration ... "));
    Serial.println(WiFi.softAPConfig(local_IP, gateway, subnet) ? F("Ready") : F("Failed!"));

    Serial.print(F("Setting soft-AP ... "));
    Serial.println(WiFi.softAP(ssid, password) ? F("Ready") : F("Failed!"));

    Serial.print(F("Soft-AP IP address = "));
    Serial.println(WiFi.softAPIP());

    WiFi.printDiag(Serial);
}


/******************************/
/****  CAN  *******************/
/******************************/
// MCP2515 oscillator frequency
#define CRYSTAL_FREQUENCY MCP_8MHZ
#define LOOPBACK_MODE true
// CAN0 INT and CS
#define CAN0_INT D2
MCP_CAN CAN0(D1);   // Set CS to pin D1
boolean isCanStarted = false;
boolean isClintStarted = false;

unsigned long loopbackPrevTX = 0;
byte loopbackCanTestData[] = {0xAA, 0x55, 0x01, 0x10, 0xFF, 0x12, 0x34, 0x56};

struct canDataItem {
    unsigned long id;
    unsigned char len;
    unsigned char buf[8];
};
canDataItem canDataItems[200];  // size is (4 + 1 + 8) * 200
unsigned int canDataIndex = 0;

boolean canStart(int canSpeed) {
    boolean ran = CAN0.begin(MCP_ANY, canSpeed, CRYSTAL_FREQUENCY) == CAN_OK;
    if (ran) {
        isCanStarted = true;
        isClintStarted = true;
        if (LOOPBACK_MODE) {
            CAN0.setMode(MCP_LOOPBACK);
        } else {
            CAN0.setMode(MCP_NORMAL);
        }
    }
    return ran;
}

void canStop() {
    isClintStarted = false;
    canDataIndex = 0;
}

void handleCanBus() {
    if (!isCanStarted) {
        return;
    }
    if (!digitalRead(CAN0_INT)) {
        if (CAN0.readMsgBuf(
                &canDataItems[canDataIndex].id,
                &canDataItems[canDataIndex].len,
                canDataItems[canDataIndex].buf
            ) == CAN_OK &&
            isClintStarted
        ) {
            canDataIndex++;
            if (canDataIndex >= 200) {
                canDataIndex = 0;
                Serial.println(F("[Error] Can data buffer overload"));
            }
        }
    }

    if (LOOPBACK_MODE) {
        // send loopback test data each second
        if (millis() - loopbackPrevTX >= 10000) {
            loopbackPrevTX = millis();
            if (CAN0.sendMsgBuf(0x100, 8, loopbackCanTestData) == CAN_OK) {
                // Serial.println(F("[CAN Loopback] Message Sent Successfully!"));
            } else {
                Serial.println(F("[CAN Loopback] Error Sending Message..."));
            }
        }
    }
}


/******************************/
/****  WEB  *******************/
/******************************/
#include "assets/index.h"
#include "assets/scripts.h"
#include "assets/styles.h"

const char CONTENT_TYPE_JSON[] PROGMEM = "application/json";
const char CONTENT_TYPE_TEXT[] PROGMEM = "text/plain";

ESP8266WebServer server(80);

void sendContent(int code, PGM_P contentType, PGM_P content) {
    server.send_P(code, contentType, content);
}

void sendJsonContent(int code, String content) {
    server.send(code, CONTENT_TYPE_JSON, content);
}

void sendIndexHtml() {
    sendContent(200, ASSET_INDEX_HTML_TYPE, ASSET_INDEX_HTML_CONTENT);
}

void sendScriptsJs() {
    sendContent(200, ASSET_SCRIPTS_JS_TYPE, ASSET_SCRIPTS_JS_CONTENT);
}

void sendStylesCss() {
    sendContent(200, ASSET_STYLES_CSS_TYPE, ASSET_STYLES_CSS_CONTENT);
}

void handleNotFound() {
    sendContent(404, CONTENT_TYPE_TEXT, PSTR("Not found"));
}

void handleStart() {
    int speed = server.arg(F("speed")).toInt();
    if (canStart(speed)) {
        sendContent(200, CONTENT_TYPE_JSON, PSTR("{\"message\":\"OK\"}"));
    } else {
        sendContent(200, CONTENT_TYPE_JSON, PSTR("{\"error\":\"MCP2515 Initialization has failed\"}"));
    }
}

void handleStop() {
    canStop();
    sendContent(200, CONTENT_TYPE_JSON, PSTR("{\"message\":\"OK\"}"));
}

void handleGetData() {
    String response = "{\"data\":";
    if (canDataIndex > 0) {
        String items = "[";
        for (int i = 0; i < canDataIndex; i++) {
            String data = "[";
            for (int j = 0; j < canDataItems[i].len; j++) {
                if (j != 0) {
                    data += ",";
                }
                data += String(canDataItems[i].buf[j]);
            }
            data += "]";

            String item = "{\"type\":";
            item += String(canDataItems[i].id & 0xE0000000);
            item += ",\"id\":";
            item += String(canDataItems[i].id & 0x1FFFFFFF);
            item += ",\"data\":";
            item += data;
            item += "}";

            if (i != 0) {
                items += ",";
            }
            items += item;
        }
        items += "]";
        response += items;
        canDataIndex = 0;
    } else {
        response += "[]";
    }

    response += "}";
    Serial.println(response);
    sendJsonContent(200, response);
}

void webServerSetup() {
    server.on("/", HTTP_GET, sendIndexHtml);
    server.on("/scripts.js", HTTP_GET, sendScriptsJs);
    server.on("/styles.css", HTTP_GET, sendStylesCss);
    server.on("/start", HTTP_POST, handleStart);
    server.on("/stop", HTTP_GET, handleStop);
    server.on("/getdata", HTTP_GET, handleGetData);
    server.onNotFound(handleNotFound);

    server.begin();
    Serial.println(F("HTTP server started"));
}


/******************************/
/****  APP  *******************/
/******************************/
void setup() {
    Serial.begin(115200);
    Serial.println();

    pinMode(CAN0_INT, INPUT);

    wifiSetup();
    webServerSetup();
}

void loop() {
    server.handleClient();
    handleCanBus();
}
