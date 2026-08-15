
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
if (!DATABASE_URL || !JWT_SECRET) {
  console.warn("Set DATABASE_URL and JWT_SECRET before production deployment.");
}
const pool = new Pool({ connectionString: DATABASE_URL, ssl: DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false } });

const seed = {
  members: [
    { id:"m1", code:"LBFG-NP-000001", name:"Sita Kumari Thapa", citizenship:"12-01-70-00123", phone:"9841000001", address:"Butwal-5, Rupandehi", nominee:"Ram Thapa (Husband)", joinDate:"2023-02-11", status:"active" },
    { id:"m2", code:"LBFG-NP-000002", name:"Hari Prasad Sharma", citizenship:"05-02-71-00456", phone:"9841000002", address:"Bhairahawa-3, Rupandehi", nominee:"Gita Sharma (Wife)", joinDate:"2023-04-02", status:"active" },
    { id:"m3", code:"LBFG-NP-000003", name:"Kamala Devi Gurung", citizenship:"22-03-69-00789", phone:"9841000003", address:"Lumbini-2, Rupandehi", nominee:"Suman Gurung (Son)", joinDate:"2024-01-19", status:"active" }
  ],
  tx: [],
  loans: [],
  users: [
    { id:"u1", username:"admin", password:"admin123", role:"admin", name:"System Admin", linkedMemberId:null },
    { id:"u2", username:"manager", password:"manager123", role:"manager", name:"Bimala Rana (Manager)", linkedMemberId:null },
    { id:"u3", username:"accountant", password:"account123", role:"accountant", name:"Deepak Koirala (Accountant)", linkedMemberId:null },
    { id:"u4", username:"staff", password:"staff123", role:"staff", name:"Sunita Oli (Field Staff)", linkedMemberId:null },
    { id:"u5", username:"member1", password:"member123", role:"member", name:"Sita Kumari Thapa", linkedMemberId:"m1" }
  ],
  loginLog: [],
  orgLogo: ""
};

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      linked_member_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  const count = Number((await pool.query("SELECT COUNT(*) FROM app_state")).rows[0].count);
  if (!count) {
    const initial = { members: seed.members, transactions: seed.tx, loans: seed.loans, users: seed.users.map(({password,...u})=>u), "login-log": seed.loginLog, "org-logo": seed.orgLogo };
    for (const [key, value] of Object.entries(initial)) {
      await pool.query("INSERT INTO app_state(key,value) VALUES($1,$2)", [key, JSON.stringify(value)]);
    }
    for (const u of seed.users) {
      await pool.query(
        "INSERT INTO app_users(id,username,password_hash,role,name,linked_member_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(username) DO NOTHING",
        [u.id, u.username, await bcrypt.hash(u.password, 12), u.role, u.name, u.linkedMemberId]
      );
    }
  }
}

function auth(req,res,next){
  try {
    const token = req.cookies.lbfg_session;
    if (!token) return res.status(401).json({error:"Not signed in."});
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { return res.status(401).json({error:"Session expired. Please sign in again."}); }
}
function canWrite(user) { return ["admin","manager","accountant","staff"].includes(user.role); }

app.post("/api/login", async (req,res)=>{
  try {
    const {username,password,role} = req.body || {};
    const q = await pool.query("SELECT * FROM app_users WHERE username=$1 AND role=$2", [username, role]);
    const u = q.rows[0];
    if (!u || !(await bcrypt.compare(password || "", u.password_hash))) return res.status(401).json({error:"Incorrect username, role or password."});
    const safe = { id:u.id, username:u.username, role:u.role, name:u.name, linkedMemberId:u.linked_member_id };
    const token = jwt.sign(safe, JWT_SECRET, {expiresIn:"12h"});
    res.cookie("lbfg_session", token, {httpOnly:true, sameSite:"lax", secure:process.env.NODE_ENV==="production", maxAge:12*60*60*1000});
    res.json({user:safe});
  } catch(e){ res.status(500).json({error:e.message}); }
});
app.post("/api/logout",(req,res)=>{res.clearCookie("lbfg_session");res.json({ok:true});});

app.get("/api/state", auth, async (req,res)=>{
  try {
    const q = await pool.query("SELECT key,value FROM app_state");
    const data = {};
    for (const r of q.rows) {
      const key = r.key === "transactions" ? "tx" : r.key === "login-log" ? "loginLog" : r.key === "org-logo" ? "orgLogo" : r.key;
      data[key] = r.value;
    }
    // Passwords never go to the browser.
    data.users = (await pool.query("SELECT id,username,role,name,linked_member_id AS \"linkedMemberId\" FROM app_users ORDER BY username")).rows;
    res.json({data});
  } catch(e){res.status(500).json({error:e.message});}
});

app.put("/api/state", auth, async (req,res)=>{
  if (!canWrite(req.user)) return res.status(403).json({error:"You do not have permission to change data."});
  try {
    const {key,value}=req.body||{};
    const dbKey = key === "tx" ? "transactions" : key === "loginLog" ? "login-log" : key === "orgLogo" ? "org-logo" : key;
    if (!["members","transactions","loans","login-log","org-logo"].includes(dbKey)) {
      if (dbKey === "users" && req.user.role === "admin") {
        // User CRUD is intentionally handled separately in the next security iteration.
        return res.status(400).json({error:"Use the Users API for account changes."});
      }
      return res.status(400).json({error:"Unsupported state key."});
    }
    await pool.query(
      "INSERT INTO app_state(key,value,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()",
      [dbKey, JSON.stringify(value)]
    );
    res.json({ok:true});
  } catch(e){res.status(500).json({error:e.message});}
});

app.get("/api/health",(req,res)=>res.json({ok:true,service:"LBFG Online"}));

const dist = path.resolve(__dirname, "../dist");
app.use(express.static(dist));
app.get("*",(req,res)=>res.sendFile(path.join(dist,"index.html")));

initDb().then(()=>app.listen(PORT,()=>console.log(`LBFG Online listening on ${PORT}`))).catch(e=>{console.error(e);process.exit(1);});
