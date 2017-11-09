const {ArgumentParser} = require('argparse');
const {build} = require('./lib/buildWinService');
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
  const svc = build(7451, 1080);
  svc.stop();
} else if (cliArgs.service_start) {
  const svc = build(7451, 1080);
  svc.start();
} else if (cliArgs.service_restart) {
  const svc = build(7451, 1080);
  svc.stop();
  svc.start();
} else if (cliArgs.service_install) {
  const svc = build(7451, 1080);
  svc.install();
} else if (cliArgs.service_uninstall) {
  const svc = build(7451, 1080);
  svc.uninstall();
} else {
  parser.printUsage();
}
