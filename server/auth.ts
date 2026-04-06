import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { storage } from "./storage";
import { User } from "@shared/schema";

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
        // Note: For a production app we'd hash the password. Since this is a simple setup per the instruction constraints, we do plaintext compare.
        if (!user || user.password !== password) {
          return done(null, false, { message: "Invalid username or password" });
        }
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
  app.post("/api/register", async (req, res, next) => {
    try {
      const existing = await storage.getUserByUsername(req.body.username);
      if (existing) {
        return res.status(400).send("Username already exists");
      }
      
      const user = await storage.createUser({
        username: req.body.username,
        password: req.body.password,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.json(req.user);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).send("Not authenticated");
    }
  });
}
