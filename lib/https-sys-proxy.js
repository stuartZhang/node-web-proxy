const {promisify} = require('util');
const Socks = require('socks');
const debug = require('debug');
const _ = require('underscore');

const {getHostPortFromString, IGNORE_FRONT_ERR} = require('./utils');

const createConnection = promisify(Socks.createConnection);

module.exports = async function httpsProxy(gLogger, SYSTEM_PROXY, request, socketRequest, bodyhead){
  const {httpVersion, url, client: {remoteAddress}} = request;
  const hostport = getHostPortFromString(url, 443);
  const logger = _.defaults({
    htpsProxy: debug('https-proxy'),
    htpsProxyErr: debug('https-proxy-error')
  }, gLogger);
  logger.guest(`${remoteAddress} [paid proxy] ${url}`);
  logger.htpsProxy(` = will connect to ${hostport.join(':')}`);
  const options = {
    proxy: SYSTEM_PROXY,
    target: {
      host: hostport[0], // can be an ip address or domain (4a and 5 only)
      port: hostport[1]
    }
  };
  logger.htpsProxy(`  > options: ${JSON.stringify(options, null, 2)}`);
  const proxySocket = await createConnection(options); // set up TCP connection
  // BIND request has completed.
  logger.htpsProxy(`  < connected to ${hostport.join(':')}`);
  logger.htpsProxy(`  > writing head of length ${bodyhead.length}`);
  proxySocket.on("data", function(chunk){ // backend -> frontend
    logger.htpsProxy(`  < data length = ${chunk.length}`);
    socketRequest.write(chunk);
  }).on("end", function() { // backend stops frontend
    logger.htpsProxy("  < end");
    socketRequest.end();
  }).on("error", function(err){ // backend stops frontend, due to error
    logger.htpsProxyErr(`${url} - Backend ${err}`);
    socketRequest.write("HTTP/" + httpVersion + " 500 Connection error\r\n\r\n");
    socketRequest.end();
  });
  proxySocket.write(bodyhead);
  proxySocket.resume();
  // tell the caller the connection was successfully established
  socketRequest.on("data", function(chunk){ // frontend -> backend
    logger.fsock(`  > data length = ${chunk.length}`);
    proxySocket.write(chunk);
  }).on("end", function(){ // frontend stops backend
    logger.fsock("  > end");
    proxySocket.end();
  }).on("error", function(err){ // frontend stops backend, due to error
    if (IGNORE_FRONT_ERR.includes(err.code)) {
      logger.fsock(`  > main proxy ${url} ERR: ${err}`);
    } else {
      logger.htpsProxyErr(`${url} - Frontend ${err}`);
      proxySocket.end();
    }
  });
  socketRequest.write("HTTP/" + httpVersion + " 200 Connection established\r\n\r\n");
};