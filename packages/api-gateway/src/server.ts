import { getDb } from "./db/index.js";
import { createApp } from "./app.js";

createApp(getDb()).listen(3000);
