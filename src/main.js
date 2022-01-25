// This is main process of Electron, started as first thing when your
// app starts. It runs through entire life of your application.
// It doesn't have any windows which you can see on screen, but we can open
// window from here.

import path from "path";
import url from "url";
import { app, Menu, ipcMain, shell } from "electron";
import appMenuTemplate from "./menu/app_menu_template";
import editMenuTemplate from "./menu/edit_menu_template";
import devMenuTemplate from "./menu/dev_menu_template";
import createWindow from "./helpers/window";

// Special module holding environment variables which you declared
// in config/env_xxx.json file.
import env from "env";
import { DynamicEntryPlugin } from "webpack";


const log = require('electron-log')


// Save userData in separate folders for each environment.
// Thanks to this you can use production and development versions of the app
// on same machine like those are two separate apps.
if (env.name !== "production") {
  const userDataPath = app.getPath("userData");
  app.setPath("userData", `${userDataPath} (${env.name})`);
}

const PY_DIST_FOLDER = "pyflaskdist";
const PY_FOLDER = "pyflask";
const PY_MODULE = "api";
let mainWindow;

let pyProc = null;
const pyPort = "5000";

const guessPackaged = () => {
  const unixPath = path.join(process.resourcesPath, PY_MODULE);
  const winPath = path.join(process.resourcesPath, PY_MODULE + ".exe");

  if (require("fs").existsSync(unixPath) || require("fs").existsSync(winPath)) {
    return true;
  } else {
    return false;
  }
};

// check if the python dist folder exists
const getScriptPath = () => {
  if (!guessPackaged()) {
    return path.join(__dirname, "..", "src", PY_FOLDER, PY_MODULE + ".py");
  }

  if (process.platform === "win32") {
    log.info(path.join(process.resourcesPath, PY_MODULE + ".exe"))
    return path.join(process.resourcesPath, PY_MODULE + ".exe");
  }

  return path.join(process.resourcesPath, PY_MODULE);
};

// create the python process
const createPyProc = () => {
  let script = getScriptPath();

  console.log(`Starting python process at ${script}`);
  console.log(`API documentation hosted at http://127.0.0.1:7632/docs`);
  if (guessPackaged()) {
    pyProc = require("child_process").execFile(script, [pyPort], {
      stdio: "ignore",
    });
  } else {
    pyProc = require("child_process").spawn("python", [script, pyPort], {
      stdio: "ignore",
    });
  }

  if (pyProc != null) {
    console.log("child process success on port " + pyPort);
  } else {
    console.error("child process failed to start on port" + pyPort);
  }
};

// Close the webserver process on app exit
const exitPyProc = (main_pid) => {
  console.log("killling python process...");
  if ((process.platform == "darwin") | (process.platform == "linux")) {
    pyProc.kill();
    return new Promise(function (resolve) {
      resolve();
    });
  } else {
    const python_script_name = path.basename(getScriptPath());
    let cleanup_completed = false;
    const psTree = require("ps-tree");
    psTree(main_pid, function (_err, children) {
      let python_pids = children
        .filter(function (el) {
          return el.COMMAND == python_script_name;
        })
        .map(function (p) {
          return p.PID;
        });
      // kill all the spawned python processes
      python_pids.forEach(function (pid) {
        process.kill(pid);
      });
      pyProc = null;
      cleanup_completed = true;
    });
    return new Promise(function (resolve) {
      (function waitForSubProcessCleanup() {
        if (cleanup_completed) return resolve();
        setTimeout(waitForSubProcessCleanup, 30);
      })();
    });
  }
};


const setApplicationMenu = () => {
  const menus = [appMenuTemplate, editMenuTemplate];
  if (env.name !== "production") {
    menus.push(devMenuTemplate);
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(menus));
};

// We can communicate with our window (the renderer process) via messages.
const initIpc = () => {
  ipcMain.on("need-app-path", (event, arg) => {
    event.reply("app-path", app.getAppPath());
  });
  ipcMain.on("open-external-link", (event, href) => {
    shell.openExternal(href);
  });
};

app.on("ready", () => {
  setApplicationMenu();
  initIpc();

  const mainWindow = createWindow("main", {
    width: 1000,
    height: 600,
    webPreferences: {
      // Two properties below are here for demo purposes, and are
      // security hazard. Make sure you know what you're doing
      // in your production app.
      nodeIntegration: true,
      contextIsolation: false,
      // Spectron needs access to remote module
      enableRemoteModule: env.name === "test"
    }
  });

  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "index.html"),
      protocol: "file:",
      slashes: true
    })
  );

  //f (env.name === "development") {
    mainWindow.openDevTools();
  //}

  if(env.name === "production") {
    let varName = "cheerios"
    try{
      throw new Error(`Problem with: `, varName)
    } catch(e) {
      log.error(e)
      console.error(e)
    }
  }

  createPyProc()
});

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // This might need to be moved into the `will-quit` event. Would need some checking on autoupdates.
  exitPyProc(process.pid).then(() => {
    app.quit();
  })
})
