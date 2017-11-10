require('promise-tap').mix(Promise.prototype);
const {ArgumentParser} = require('argparse');
const {build, SERVER_LOG_DIR} = require('./lib/buildWinService');
const {Tail} = require('tail');
const path = require('path');
const parser = new ArgumentParser({
  version: '0.0.1',
  addHelp: true,
  description: 'A HTTP(S) Forward Proxy built upon nodejs'
});
parser.addArgument([ '-si', '--service-install' ], {
  action: 'storeTrue',
  dest: 'serviceInstall',
  help: 'Install HTTP(S) Proxy as a system service'
});
parser.addArgument([ '-su', '--service-uninstall' ], {
  action: 'storeTrue',
  dest: 'serviceUninstall',
  help: 'Uninstall HTTP(S) Proxy as a system service'
});
parser.addArgument([ '-st', '--service-start' ], {
  action: 'storeTrue',
  dest: 'serviceStart',
  help: 'Start the system-service HTTP(S) Proxy'
});
parser.addArgument([ '-sp', '--service-stop' ], {
  action: 'storeTrue',
  dest: 'serviceStop',
  help: 'Stop the system-service HTTP(S) Proxy'
});
parser.addArgument([ '-sr', '--service-restart' ], {
  action: 'storeTrue',
  dest: 'serviceRestart',
  help: 'Restart the system-service HTTP(S) Proxy'
});
parser.addArgument([ '-t', '--trace' ], {
  action: 'storeTrue',
  help: 'Trace the proxy logs'
});
parser.addArgument([ '-p', '--port' ], {
  action: 'store',
  defaultValue: process.env.PORT || 5555,
  help: 'The port on which the HTTP(S) Proxy to listens. (Default: 5555)',
  type: 'int'
});
parser.addArgument([ '-spp', '--system-proxy-port' ], {
  action: 'store',
  defaultValue: process.env.SYSTEM_PROXY_PORT || 1080,
  dest: 'sysProxyPort',
  help: 'The port number of the system proxy underlying the HTTP(S) Forward Proxy. (Default: 1080)',
  type: 'int'
});
const cliArgs = parser.parseArgs();
if (cliArgs.serviceStop) { // Stop the Forward Proxy service
  build(cliArgs.port, cliArgs.sysProxyPort).tap(svc => svc.stop());
} else if (cliArgs.serviceStart) { // Start the Forward Proxy service
  build(cliArgs.port, cliArgs.sysProxyPort).tap(svc => svc.start());
} else if (cliArgs.serviceRestart) { // Restart the Forward Proxy service
  build(cliArgs.port, cliArgs.sysProxyPort).tap(svc => svc.stop()).tap(svc => svc.start());
} else if (cliArgs.serviceInstall) { // Install the Forward Proxy service
  build(cliArgs.port, cliArgs.sysProxyPort).tap(svc => svc.install());
} else if (cliArgs.serviceUninstall) { // Uninstall the Forward Proxy service
  build(cliArgs.port, cliArgs.sysProxyPort).tap(svc => svc.uninstall());
} else if (cliArgs.trace) { // Uninstall the Forward Proxy service
  const tail = new Tail(path.resolve(SERVER_LOG_DIR, 'httpsproxy.err.log'), {useWatchFile: true});
  tail.on("line", function(data) {
    console.log(data);
  }).on("error", function(error) {
    console.error(error);
  });
  tail.watch();
} else { // Print out the usage.
  parser.printHelp();
}
