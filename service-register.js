require('promise-tap').mix(Promise.prototype);
const {build, SERVER_LOG_DIR} = require('./lib/buildWinService');
const {Tail} = require('tail');
const path = require('path');

const {buildServiceCliArgs} = require('./lib/utils');

const cliArgs = buildServiceCliArgs();
const {port, sysProxyPort, gwlFilePath, prFilePath} = cliArgs;

if (cliArgs.serviceStop) { // Stop the Forward Proxy service
  build(port, sysProxyPort, gwlFilePath, prFilePath).tap(svc => svc.stop());
} else if (cliArgs.serviceStart) { // Start the Forward Proxy service
  build(port, sysProxyPort, gwlFilePath, prFilePath).tap(svc => svc.start());
} else if (cliArgs.serviceRestart) { // Restart the Forward Proxy service
  build(port, sysProxyPort, gwlFilePath, prFilePath).tap(svc => svc.stop()).tap(svc => svc.start());
} else if (cliArgs.serviceInstall) { // Install the Forward Proxy service
  build(port, sysProxyPort, gwlFilePath, prFilePath).tap(svc => svc.install());
} else if (cliArgs.serviceUninstall) { // Uninstall the Forward Proxy service
  build(port, sysProxyPort, gwlFilePath, prFilePath).tap(svc => svc.uninstall());
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
