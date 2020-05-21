"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");

const entities = new Map();
const entitiesPath = "./entities/";
const httpError = (res, status, message) => {
  res.statusCode = status;
  res.end(message);
};

global.config = JSON.parse(fs.readFileSync("config.json"));

fs.readdirSync(entitiesPath).forEach((name) => {
  const filePath = entitiesPath + name;
  const key = path.basename(filePath, ".js");
  try {
    const libPath = require.resolve(filePath);
    delete require.cache[libPath];
  } catch (e) {
    return;
  }
  try {
    const entity = require(filePath);
    entities.set(key, entity);
  } catch (e) {
    entities.delete(name);
  }
});

http
  .createServer(async (req, res) => {
    const url = req.url === "/" ? "/index.html" : req.url;
    const [type, name, action] = url.substring(1).split("/");
    if (type === "api") {
      const entity = entities.get(name);
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", async () => {
        try {
          const result = await entity[action](JSON.parse(chunks.join("")));
          if (typeof result === "object") {
            res.end(JSON.stringify(result));
          } else if (
            typeof result !== "string" &&
            !(result instanceof Buffer)
          ) {
            httpError(res, 500, "Server error");
            return;
          } else res.end(result);
        } catch (e) {
          httpError(res, 500, "Server error");
        }
      });
    } else {
      const path = `./static${url}`;
      fs.exists(path, (exists) => {
        if (exists) fs.createReadStream(path).pipe(res);
        else httpError(res, 404, "File is not found");
      });
    }
  })
  .listen(global.config.port);
