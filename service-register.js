const {Service} = require('node-windows');
const path = require('path');
const fs = require('fs');
const {ArgumentParser} = require('argparse');
// Create a new service object
const SERVICE_NAME = 'HTTPS Proxy';
const SERVER_LOG_DIR = path.resolve(__dirname, 'service-logs');
if (!fs.existsSync(SERVER_LOG_DIR)) {
  fs.mkdirSync(SERVER_LOG_DIR);
}
const svc = new Service({
  name: SERVICE_NAME,
  description: 'Web Proxy for HTTP(s) through the system proxy.',
  script: path.resolve(__dirname, 'lib/proxy.js'),
  abortOnError: false,
  logpath: SERVER_LOG_DIR,
  env: [{
    name: 'DEBUG',
    value: '*'
  }, {
    name: 'LISTEN_PORT',
    value: 7451
  }, {
    name: 'SYSTEM_PROXY_PORT',
    value: 1080
  }]
});
console.log(`Service Log at: ${SERVER_LOG_DIR}`);
// Listen for the "install" event, which indicates the process is available as a service.
let isReinstall = false;
svc.on('install',() => {
  console.log(` > Install ${SERVICE_NAME}`);
  svc.start();
}).on('alreadyinstalled', () => {
  console.log(` * ${SERVICE_NAME} is here`);
  svc.uninstall();
  isReinstall = true;
}).on('invalidinstallation', () => {
  console.log(` * Fail to install ${SERVICE_NAME}`);
}).on('start', () => {
  console.log(` > Start ${SERVICE_NAME}`);
}).on('stop', () => {
  console.log(` > Stop ${SERVICE_NAME}`);
}).on('uninstall', () => {
  console.log(` > Uninstall ${SERVICE_NAME}`);
  if (isReinstall) {
    isReinstall = false;
    svc.install();
  }
});
const parser = new ArgumentParser({
  version: '0.0.1',
  addHelp: true,
  description: 'A HTTP(S) Forward Proxy built upon nodejs'
});
parser.addArgument([ '-si', '--service-install' ], {
  action: 'storeTrue',
  help: 'Install HTTP(S) Proxy as a system service'
});
parser.addArgument([ '-su', '--service-uninstall' ], {
  action: 'storeTrue',
  help: 'Uninstall HTTP(S) Proxy as a system service'
});
parser.addArgument([ '-st', '--service-start' ], {
  action: 'storeTrue',
  help: 'Start the system-service HTTP(S) Proxy'
});
parser.addArgument([ '-sp', '--service-stop' ], {
  action: 'storeTrue',
  help: 'Stop the system-service HTTP(S) Proxy'
});
parser.addArgument([ '-sr', '--service-restart' ], {
  action: 'storeTrue',
  help: 'Restart the system-service HTTP(S) Proxy'
});
const cliArgs = parser.parseArgs();
if (cliArgs.service_stop) {
  svc.stop();
} else if (cliArgs.service_start) {
  svc.start();
} else if (cliArgs.service_restart) {
  svc.stop();
  svc.start();
} else if (cliArgs.service_install) {
  svc.install();
} else if (cliArgs.service_uninstall) {
  svc.uninstall();
} else {
  parser.printUsage();
}
