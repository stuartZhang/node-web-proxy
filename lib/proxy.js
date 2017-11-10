const {ArgumentParser} = require('argparse');
const http = require("http");
const net = require("net");
const Socks = require('socks');
const debug = require('debug');
const _ = require('underscore');
const {FindProxyForURL, PROXY} = require('./pac');
const guestWhiteList = require('../config/guest-whitelist');

const logger = {
  fsock: debug('frontend-socket'),
  bsock: debug('backend-socket'),
  pfsock: debug('paid-traffic'),
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
  type: 5 // type is REQUIRED. Valid types: [4, 5]  (note 4 also works for 4a)
};
const regex_hostport = /^([^:]+)(:([0-9]+))?$/;
const regex_path = /^[a-zA-Z]+:\/\/[^\/]+(\/.*)?$/;

function getHostPortFromString(hostString, defaultPort){
  let host = hostString;
  let port = defaultPort;
  let result = regex_hostport.exec(hostString);
  if (result != null) {
    host = result[1];
    if (result[2] != null) {
      port = result[3];
    }
  }
  return [host, port];
}
// handle a HTTP proxy request
function httpUserRequest(userRequest, userResponse){
  logger.bsock(`  > request: ${userRequest.url}`);
  const httpVersion = userRequest["httpVersion"];
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
logger.fsock(`forward proxy listening on port ${cliArgs.port}`);
logger.bsock(`system proxy on port ${cliArgs.sysProxyPort}`);
// start HTTP server with custom request handler callback function
const server = http.createServer(httpUserRequest).listen(cliArgs.port);
// add handler for HTTPS (which issues a CONNECT to the proxy)
server.addListener("connect", function(request, socketRequest, bodyhead){
  const guestId = request.client.remoteAddress;
  const url = request["url"];
  const httpVersion = request["httpVersion"];
  const hostport = getHostPortFromString(url, 443);
  const proxyType = FindProxyForURL(url, hostport[0]);
  // console.log(proxyType, url, hostport[0]);
  if (proxyType === PROXY && guestWhiteList.has(guestId)) {
    logger.guest(`${guestId} [paid proxy] ${url}`);
    logger.pfsock(` = will connect to ${hostport.join(':')}`);
    const options = {
      proxy: SYSTEM_PROXY,
      target: {
        host: hostport[0], // can be an ip address or domain (4a and 5 only)
        port: parseInt(hostport[1])
      },
      command: 'connect'  // This defaults to connect, so it's optional if you're not using BIND or Associate.
    };
    logger.pfsock(`  > options: ${JSON.stringify(options, null, 2)}`);
    // set up TCP connection
    Socks.createConnection(options, function(err, proxySocket, info) {
      if (err) {
        return console.error(err);
      }
      // BIND request has completed.
      // info object contains the remote ip and newly opened tcp port to connect to.
      logger.pfsock(`  < connected to ${hostport.join(':')}`);
      logger.pfsock(`  > writing head of length ${bodyhead.length}`);
      proxySocket.on("data", function(chunk){
        logger.pfsock(`  < data length = ${chunk.length}`);
        socketRequest.write(chunk);
      }).on("end", function() {
        logger.pfsock("  < end");
        socketRequest.end();
      }).on("error", function(err){
        logger.error(`  < main proxy ERR: ${err}`);
        socketRequest.write("HTTP/" + httpVersion + " 500 Connection error\r\n\r\n");
        socketRequest.end();
      });
      proxySocket.write(bodyhead);
      proxySocket.resume();
      // tell the caller the connection was successfully established
      socketRequest.on("data", function(chunk){
        logger.fsock(`  > data length = ${chunk.length}`);
        proxySocket.write(chunk);
      }).on("end", function(){
        logger.fsock("  > end");
        proxySocket.end();
      }).on("error", function(err){
        if (err.code === 'ECONNRESET') {
          logger.fsock(`  > main proxy ${url} ERR: ${err}`);
        } else {
          logger.error(`  > main proxy ${url} ERR: ${err}`);
          proxySocket.end();
        }
      });
      socketRequest.write("HTTP/" + httpVersion + " 200 Connection established\r\n\r\n");
    });
  } else {
    logger.guest(`${guestId} [direct] ${url}`);
    logger.bsock(` = will connect to ${hostport.join(':')}`);
    // set up TCP connection
    const proxySocket = new net.Socket();
    proxySocket.connect(parseInt(hostport[1]), hostport[0], function() {
      logger.bsock(`  < connected to ${hostport.join(':')}`);
      logger.bsock(`  > writing head of length ${bodyhead.length}`);
      proxySocket.write(bodyhead);
      // tell the caller the connection was successfully established
      socketRequest.write("HTTP/" + httpVersion + " 200 Connection established\r\n\r\n");
    });
    proxySocket.on("data", function(chunk) {
      logger.bsock(`  < data length = ${chunk.length}`);
      socketRequest.write(chunk);
    }).on("end", function() {
      logger.bsock("  < end");
      socketRequest.end();
    }).on("error", function(err) {
      logger.error(`  < main direct ${url} ERR: ${err}`);
      socketRequest.write("HTTP/" + httpVersion + " 500 Connection error\r\n\r\n");
      socketRequest.end();
    });
    socketRequest.on("data", function(chunk) {
      logger.fsock(`  > data length = ${chunk.length}`);
      proxySocket.write(chunk);
    }).on("end", function() {
      logger.fsock("  > end");
      proxySocket.end();
    }).on("error", function(err) {
      if (err.code === 'ECONNRESET') {
        logger.fsock(`  > main direct ${url} ERR: ${err}`);
      } else {
        logger.error(`  > main direct ${url} ERR: ${err}`);
        proxySocket.end();
      }
    });
  }
}); // HTTPS connect listener
console.log('系统代理：', SYSTEM_PROXY);
