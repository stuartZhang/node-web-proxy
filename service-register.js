const Service = require('node-windows').Service;
const path = require('path');
const fs = require('fs');
// Create a new service object
const serviceName = 'HTTPS Proxy';
const serverLogDir = path.resolve(__dirname, 'service-logs');
if (!fs.existsSync(serverLogDir)) {
  fs.mkdirSync(serverLogDir);
}
const svc = new Service({
  name: serviceName,
  description: 'Web Proxy for HTTP(s) through the system proxy.',
  script: path.resolve(__dirname, 'lib/proxy.js'),
  abortOnError: true,
  logpath: serverLogDir,
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
console.log(`Service Log at: ${serverLogDir}`);
// Listen for the "install" event, which indicates the process is available as a service.
let isReinstall = false;
svc.on('install',() => {
  console.log(` > Install ${serviceName}`);
  svc.start();
}).on('alreadyinstalled', () => {
  console.log(` * ${serviceName} is here`);
  svc.uninstall();
  isReinstall = true;
}).on('invalidinstallation', () => {
  console.log(` * Fail to install ${serviceName}`);
}).on('start', () => {
  console.log(` > Start ${serviceName}`);
}).on('stop', () => {
  console.log(` > Stop ${serviceName}`);
}).on('uninstall', () => {
  console.log(` > Uninstall ${serviceName}`);
  if (isReinstall) {
    isReinstall = false;
    svc.install();
  }
});
svc.install();
