import express, { type Express } from "express";
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";


const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);


app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



app.use("/api", router);

if (process.env.NODE_ENV === 'production') {
  const publicDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../auto-service-hub/dist/public');
  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Not found' }); });
  app.use(express.static(publicDirectory));
  app.get('/{*path}', (req, res, next) => {
    if (!req.accepts('html') || path.extname(req.path)) { next(); return; }
    res.sendFile(path.join(publicDirectory, 'index.html'));
  });
}

export default app;

