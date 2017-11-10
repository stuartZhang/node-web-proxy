const {ArgumentParser} = require('argparse');
const {build} = require('./lib/buildWinService');
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
if (cliArgs.serviceStop) {
  build(cliArgs.port, cliArgs.sysProxyPort).stop();
} else if (cliArgs.serviceStart) {
  build(cliArgs.port, cliArgs.sysProxyPort).start();
} else if (cliArgs.serviceRestart) {
  const svc = build(cliArgs.port, cliArgs.sysProxyPort);
  svc.stop();
  svc.start();
} else if (cliArgs.serviceInstall) {
  build(cliArgs.port, cliArgs.sysProxyPort).install();
} else if (cliArgs.serviceUninstall) {
  build(cliArgs.port, cliArgs.sysProxyPort).uninstall();
} else {
  parser.printHelp();
  parser.printUsage();
}
