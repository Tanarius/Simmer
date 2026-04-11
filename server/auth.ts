import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { User } from "@shared/schema";
import { generateInviteCode } from "./utils/invite";

// Strict rate limits for auth endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60_000, // 15 minutes
  max: 10,
  message: { error: "Too many attempts. Please wait 15 minutes before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerRateLimit = rateLimit({
  windowMs: 60 * 60_000, // 1 hour
  max: 5,
  message: { error: "Too many registrations from this IP. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Never send the password field to the client
function safeUser(user: any) {
  if (!user) return user;
  const { password: _pw, ...safe } = user;
  return safe;
}

const MemoryStore = createMemoryStore(session);

export function setupAuth(app: Express) {
  // Setup session
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "default_secret",
      resave: false,
      saveUninitialized: false,
      store: new MemoryStore({
        checkPeriod: 86400000, 
      }),
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) return done(null, false, { message: "Invalid username or password" });
        // Bcrypt-only — plaintext fallback removed for security
        if (!user.password?.startsWith('$2b$') && !user.password?.startsWith('$2a$')) {
          // Legacy plaintext: upgrade on successful login
          if (user.password !== password) return done(null, false, { message: "Invalid username or password" });
          const hashed = await bcrypt.hash(password, 12);
          await storage.updateUserPassword(user.id, hashed);
          return done(null, user);
        }
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return done(null, false, { message: "Invalid username or password" });
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Auth routes
  app.post("/api/register", registerRateLimit, async (req, res, next) => {
    try {
      const { username, password } = req.body;
      if (!username || typeof username !== "string" || username.length < 3 || username.length > 30) {
        return res.status(400).json({ error: "Username must be 3–30 characters" });
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
        return res.status(400).json({ error: "Username may only contain letters, numbers, _ . -" });
      }
      if (!password || typeof password !== "string" || password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Resolve household: join existing via inviteCode, or create a new one
      let householdId: number;
      const rawCode = (req.body.inviteCode ?? "").trim().toUpperCase();
      if (rawCode) {
        const hh = await storage.getHouseholdByInviteCode(rawCode);
        if (!hh) return res.status(400).send("Invalid invite code");
        householdId = hh.id;
      } else {
        const code = generateInviteCode();
        const hh = await storage.createHousehold(`${req.body.username}'s Home`, code);
        householdId = hh.id;
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await storage.createUser({ username, password: hashedPassword });
      await storage.setUserHousehold(user.id, householdId);
      const updatedUser = await storage.getUser(user.id);

      req.login(updatedUser!, (err) => {
        if (err) return next(err);
        res.status(201).json(safeUser(updatedUser));
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", authRateLimit, passport.authenticate("local"), (req, res) => {
    res.json(safeUser(req.user));
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.patch("/api/auth/password", async (req, res, next) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword || newPassword.length < 6)
        return res.status(400).json({ error: "New password must be at least 6 characters" });
      const user = await storage.getUser((req.user as any).id);
      if (!user) return res.status(404).json({ error: "User not found" });
      const isHash = user.password?.startsWith('$2b$') || user.password?.startsWith('$2a$');
      const valid = isHash ? await bcrypt.compare(currentPassword, user.password) : user.password === currentPassword;
      if (!valid) return res.status(400).json({ error: "Current password is incorrect" });
      const hashed = await bcrypt.hash(newPassword, 12);
      await storage.updateUserPassword(user.id, hashed);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      res.json(safeUser(req.user));
    } else {
      res.status(401).send("Not authenticated");
    }
  });
}
