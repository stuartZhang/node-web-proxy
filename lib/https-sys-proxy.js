const {promisify} = require('util');
const Socks = require('socks');
const debug = require('debug');
const _ = require('underscore');

const {getHostPortFromString} = require('./utils');

const createConnection = promisify(Socks.createConnection);

module.exports = async function httpsProxy(gLogger, SYSTEM_PROXY, request, socketRequest, bodyhead){
  const {httpVersion, url, client: {remoteAddress}} = request;
  const hostport = getHostPortFromString(url, 443);
  const logger = _.defaults({
    pfsock: debug('https-paid-traffic')
  }, gLogger);
  logger.guest(`${remoteAddress} [paid proxy] ${url}`);
  logger.pfsock(` = will connect to ${hostport.join(':')}`);
  const options = {
    proxy: SYSTEM_PROXY,
    target: {
      host: hostport[0], // can be an ip address or domain (4a and 5 only)
      port: hostport[1]
    }
  };
  logger.pfsock(`  > options: ${JSON.stringify(options, null, 2)}`);
  let proxySocket;
  try { // set up TCP connection
    proxySocket = await createConnection(options);
  } catch (err) {
    return logger.error(`  < main proxy ${url} ERR: ${err}`);
  }
  // BIND request has completed.
  logger.pfsock(`  < connected to ${hostport.join(':')}`);
  logger.pfsock(`  > writing head of length ${bodyhead.length}`);
  proxySocket.on("data", function(chunk){ // backend -> frontend
    logger.pfsock(`  < data length = ${chunk.length}`);
    socketRequest.write(chunk);
  }).on("end", function() { // backend stops frontend
    logger.pfsock("  < end");
    socketRequest.end();
  }).on("error", function(err){ // backend stops frontend, due to error
    logger.error(`  < main proxy ERR: ${err}`);
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
      logger.error(`  > main proxy ${url} ERR: ${err}`);
      proxySocket.end();
    }
  });
  socketRequest.write("HTTP/" + httpVersion + " 200 Connection established\r\n\r\n");
};