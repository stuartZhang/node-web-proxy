const {ArgumentParser} = require('argparse');
const http = require("http");
const debug = require('debug');
const _ = require('underscore');

const {FindProxyForURL, PROXY} = require('./lib/pac');
const {getHostPortFromString} = require('./lib/utils');
const guestWhiteList = require('./config/guest-whitelist');
const httpsProxy = require('./lib/https-sys-proxy');
const httpsDirect = require('./lib/https-direct');
const httpUserRequest = require('./lib/http-both');

const gLogger = {
  init: debug('proxy-init'),
  fsock: debug('frontend-socket'),
  guest: debug('guest'),
  error: debug('error')
};
const parser = new ArgumentParser({
  version: '0.0.1',
  addHelp: true,
  description: 'A HTTP(S) Forward Proxy built upon nodejs'
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
const SYSTEM_PROXY = {
  ipaddress: "localhost", // Random public proxy
  port: cliArgs.sysProxyPort,
  type: 5, // type is REQUIRED. Valid types: [4, 5]  (note 4 also works for 4a)
  command: 'connect'  // This defaults to connect, so it's optional if you're not using BIND or Associate.
};
gLogger.init(`forward proxy listening on port ${cliArgs.port}`);
gLogger.init(`system proxy on port ${cliArgs.sysProxyPort}`);
// start HTTP server with custom request handler callback function
const server = http.createServer(function(userRequest, userResponse){
  const {url, client:{remoteAddress}} = userRequest;
  const hostport = getHostPortFromString(url, 443);
  const proxyType = FindProxyForURL(url, hostport[0]);
  let sysProxy;
  if (proxyType === PROXY && guestWhiteList.has(remoteAddress)) { // paid
    sysProxy = SYSTEM_PROXY;
  } // free
  httpUserRequest(gLogger, sysProxy, userRequest, userResponse);
}).listen(cliArgs.port);
// add handler for HTTPS (which issues a CONNECT to the proxy)
server.addListener("connect", (request, socketRequest, bodyhead) => { // HTTPS connect listener
  const {url, client:{remoteAddress}} = request;
  const hostport = getHostPortFromString(url, 443);
  const proxyType = FindProxyForURL(`https://${url}`, hostport[0]);
  if (proxyType === PROXY && guestWhiteList.has(remoteAddress)) { // paid
    httpsProxy(gLogger, SYSTEM_PROXY, request, socketRequest, bodyhead)
      .catch(err => gLogger.error('https proxy -', err));
  } else { // free
    httpsDirect(gLogger, request, socketRequest, bodyhead);
  }
});
console.log('system proxy config:', SYSTEM_PROXY);
