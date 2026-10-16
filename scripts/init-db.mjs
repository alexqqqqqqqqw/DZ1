import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import bcrypt from "bcryptjs";
import pg from "pg";

import { diets } from "./catalog.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(name) {
  const full = path.join(root, name);
  if (!fs.existsSync(full)) {
    return;
  }
  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index);
    if (!process.env[key]) {
      process.env[key] = trimmed.slice(index + 1);
    }
  }
}

function quoteIdent(value) {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) {
    throw new Error(`Недопустимое имя базы: ${value}`);
  }
  return value;
}

function quoteLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function dayTotals(diet, dayIndex) {
  return ["breakfast", "lunch", "snack", "dinner"].reduce(
    (sum, slot) => sum + diet[slot][dayIndex].kcal,
    0,
  );
}

async function main() {
  loadEnvFile(".env");
  loadEnvFile(".env.local");
  const adminUrl = process.env.ADMIN_DATABASE_URL;
  const password = process.env.APP_DB_PASSWORD;
  if (!adminUrl || !password) {
    throw new Error("Нужны ADMIN_DATABASE_URL и APP_DB_PASSWORD в .env.local");
  }
  const dbName = quoteIdent(process.argv[2] ?? "norma");
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'norma_app') THEN
        CREATE ROLE norma_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
      END IF;
    END
    $$;
  `);
  await admin.query(`ALTER ROLE norma_app WITH LOGIN PASSWORD ${quoteLiteral(password)}`);
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE ${dbName}`);
  }
  await admin.query(`GRANT CONNECT ON DATABASE ${dbName} TO norma_app`);
  await admin.end();

  const target = new URL(adminUrl);
  target.pathname = `/${dbName}`;
  const client = new pg.Client({ connectionString: target.toString() });
  await client.connect();
  const schema = fs.readFileSync(path.join(root, "db", "001_schema.sql"), "utf8");
  await client.query(schema);

  for (const diet of diets) {
    await client.query(
      `INSERT INTO diet_types (id, slug, name, description, kcal_min, kcal_max, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [diet.id, diet.slug, diet.name, diet.description, diet.kcalMin, diet.kcalMax, diet.sortOrder],
    );
    for (const kind of ["day", "week"]) {
      const plan = diet[kind];
      const days = kind === "day" ? 1 : 7;
      const kcalValues = Array.from({ length: days }, (_, index) => dayTotals(diet, index));
      const kcalPerDay = Math.round(kcalValues.reduce((sum, value) => sum + value, 0) / days);
      await client.query(
        `INSERT INTO meal_plans (
           id, diet_type_id, name, duration_days, price_kopecks, description, kcal_per_day, meals_per_day
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 4)`,
        [plan.id, diet.id, plan.name, days, plan.price, plan.description, kcalPerDay],
      );
      for (let day = 1; day <= days; day += 1) {
        for (const slot of ["breakfast", "lunch", "snack", "dinner"]) {
          const dish = diet[slot][day - 1];
          await client.query(
            `INSERT INTO meals (
               meal_plan_id, day_index, slot, title, description, kcal, protein_g, fat_g, carbs_g
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [plan.id, day, slot, dish.title, dish.description, dish.kcal, dish.protein, dish.fat, dish.carbs],
          );
        }
      }
    }
  }

  const demoHash = bcrypt.hashSync("Demo12345", 10);
  await client.query(
    `INSERT INTO users (id, email, password_hash, name, phone)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      "55555555-5555-4555-8555-555555555555",
      "demo@norma.test",
      demoHash,
      "Анна Демина",
      "+79031234567",
    ],
  );
  await client.end();
  console.log(`База ${dbName} собрана. Демо-вход: demo@norma.test / Demo12345`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
