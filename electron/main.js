const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const BACKEND_PORT = process.env.PORT || "3002";
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}/index.html`;
const APP_ICON_PATH = path.join(
  __dirname,
  "..",
  "public",
  "images",
  "icon.ico",
);

let mainWindow;
let backendProcess;
let backendStartedByElectron = false;

function isBackendReachable() {
  return new Promise((resolve) => {
    const req = http.get(
      `http://127.0.0.1:${BACKEND_PORT}/api/health`,
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          resolve(false);
          return;
        }

        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const payload = JSON.parse(data);
            const normalizedStatus = String(
              payload?.status || "",
            ).toLowerCase();
            const normalizedDatabase = String(
              payload?.database || "",
            ).toLowerCase();

            // Accept both the current health payload and older legacy payloads.
            if (normalizedStatus === "ok") {
              resolve(true);
              return;
            }

            resolve(
              normalizedStatus === "healthy" &&
                normalizedDatabase === "connected",
            );
          } catch {
            resolve(false);
          }
        });
      },
    );

    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });

    req.on("error", () => resolve(false));
  });
}

async function waitForBackend(maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    // Poll until the backend starts responding.
    // eslint-disable-next-line no-await-in-loop
    const isUp = await isBackendReachable();
    if (isUp) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function startBackend() {
  const backendEntry = path.join(__dirname, "..", "backend", "server.js");

  backendProcess = spawn(process.execPath, [backendEntry], {
    cwd: path.join(__dirname, "..", "backend"),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: BACKEND_PORT,
    },
    stdio: "inherit",
  });

  backendProcess.on("exit", (code) => {
    if (code !== 0) {
      console.error(`[electron] backend exited with code ${code}`);
    }
  });

  backendStartedByElectron = true;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    icon: APP_ICON_PATH,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.setZoomFactor(0.9);
  });

  const backendReady = await waitForBackend();
  if (!backendReady) {
    dialog.showErrorBox(
      "Backend Startup Failed",
      "The local backend did not start in time. Please check backend/server.js logs and try again.",
    );
  }

  await mainWindow.loadURL(BACKEND_URL);
}

function stopBackend() {
  if (backendStartedByElectron && backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
}

app.whenReady().then(async () => {
  const backendAlreadyRunning = await isBackendReachable();
  if (!backendAlreadyRunning) {
    startBackend();
  }
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopBackend();
});
