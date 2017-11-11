const {ArgumentParser} = require('argparse');
const http = require("http");
const debug = require('debug');
const _ = require('underscore');

const {FindProxyForURL, PROXY} = require('./pac');
const {getHostPortFromString} = require('./utils');
const guestWhiteList = require('../config/guest-whitelist');
const httpsProxy = require('./https-sys-proxy');
const httpsDirect = require('./https-direct');

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
const regex_path = /^[a-zA-Z]+:\/\/[^\/]+(\/.*)?$/;

// handle a HTTP proxy request
function httpUserRequest(userRequest, userResponse){
  const logger = _.defaults({
    bsock: debug('http-backend-socket')
  }, gLogger);
  logger.bsock(`  > request: ${userRequest.url}`);
  const hostport = getHostPortFromString(userRequest.headers["host"], 80);
  // have to extract the path from the requested URL
  let path = userRequest.url;
  const result = regex_path.exec(path);
  if (result != null) {
    if (!_.isEmpty(result[1])) {
      path = result[1];
    } else {
      path = "/";
    }
  }
  const options = {
    host: hostport[0],
    port: hostport[1],
    method: userRequest.method,
    path: path,
    agent: userRequest.agent,
    auth: userRequest.auth,
    headers: userRequest.headers
  };
  logger.bsock(`  > options: ${JSON.stringify(options, null, 2)}`);
  const proxyRequest = http.request(options, function(proxyResponse) {
    logger.bsock(`  < response ${proxyResponse.statusCode} headers: ${JSON.stringify(proxyResponse.headers, null, 2)}`);
    userResponse.writeHead(proxyResponse.statusCode, proxyResponse.headers);
    proxyResponse.on("data", function(chunk) {
      logger.bsock(`  < chunk = ${chunk.length} bytes`);
      userResponse.write(chunk);
    });
    proxyResponse.on("end", function() {
      logger.bsock("  < END");
      userResponse.end();
    });
  }).on("error", function(error) {
    logger.error(`  < user ${userRequest.url} ERR: ${error}`);
    userResponse.writeHead(500);
    userResponse.write(
      "<h1>500 Error</h1>\r\n" +
        "<p>Error was <pre>" +
        error +
        "</pre></p>\r\n" +
        "</body></html>\r\n"
    );
    userResponse.end();
  });
  userRequest.addListener("data", function(chunk) {
    logger.fsock(`  > chunk = ${chunk.length} bytes`);
    proxyRequest.write(chunk);
  }).addListener("end", function() {
    logger.fsock("  > END");
    proxyRequest.end();
  }).addListener("error", function(err){
    logger.error(`  > user ${hostport.join(':')} ERR: ${err}`);
    proxyRequest.end();
  });
}
gLogger.init(`forward proxy listening on port ${cliArgs.port}`);
gLogger.init(`system proxy on port ${cliArgs.sysProxyPort}`);
// start HTTP server with custom request handler callback function
const server = http.createServer(httpUserRequest).listen(cliArgs.port);
// add handler for HTTPS (which issues a CONNECT to the proxy)
server.addListener("connect", (request, socketRequest, bodyhead) => { // HTTPS connect listener
  const guestId = request.client.remoteAddress;
  const {httpVersion, url} = request;
  const hostport = getHostPortFromString(url, 443);
  const proxyType = FindProxyForURL(url, hostport[0]);
  if (proxyType === PROXY && guestWhiteList.has(guestId)) { // paid
    httpsProxy(gLogger, SYSTEM_PROXY, request, socketRequest, bodyhead)
      .catch(err => gLogger.error('https proxy -', err));
  } else { // free
    httpsDirect(gLogger, request, socketRequest, bodyhead);
  }
});
console.log('系统代理：', SYSTEM_PROXY);
