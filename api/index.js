"use strict";
// Vercel serverless entry — wraps the Express app

const path = require("path");

// Tell Node where to resolve relative requires from inside the backend
process.chdir(path.join(__dirname, "..", "jamaica-financial-advisor"));

// Load env vars from .env (Vercel injects them as real env vars in production)
try { require("dotenv").config({ path: path.join(__dirname, "..", "jamaica-financial-advisor", ".env") }); } catch (_) {}

// Mark runtime so app.js skips static file serving (Vercel CDN handles that)
process.env.VERCEL = "1";

const marketService  = require("../jamaica-financial-advisor/src/services/market.service");
const { fetchAllNews } = require("../jamaica-financial-advisor/news-scraper");
const { checkPendingOrders } = require("../jamaica-financial-advisor/src/routes/orders.routes");
const { checkAlerts }        = require("../jamaica-financial-advisor/src/routes/alerts.routes");

let db;
try { db = require("../jamaica-financial-advisor/src/config/database"); } catch (_) {}

let app;
let started = false;

async function startup() {
  if (started) return;
  started = true;

  if (process.env.DATABASE_URL && db?.connectDatabase) {
    await db.connectDatabase().catch(() => {});
  }

  await marketService.fetchRealPrices().catch(() => {});
  marketService.startSSEBroadcast();
  fetchAllNews().catch(() => {});

  const interval = parseInt(process.env.PRICE_REFRESH_INTERVAL) || 30000;
  setInterval(() => {
    marketService.fetchRealPrices().catch(() => {});
    checkAlerts().catch(() => {});
    checkPendingOrders().catch(() => {});
  }, interval);
}

// Initialise once; subsequent invocations reuse the warm container
startup().catch(console.error);

app = require("../jamaica-financial-advisor/src/app");

module.exports = app;
