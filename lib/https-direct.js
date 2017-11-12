const net = require("net");
const _ = require('underscore');

const {getHostPortFromString, IGNORE_FRONT_ERR, debug} = require('./utils');

module.exports = function httpsDirect(gLogger, request, socketRequest, bodyhead){
  const {httpVersion, url, client: {remoteAddress}} = request;
  const hostport = getHostPortFromString(url, 443);
  const logger = _.defaults({
    htpsDirect: debug('https-direct'),
    htpsDirectErr: debug('https-direct-error')
  }, gLogger);
  logger.guest(`${remoteAddress} [direct] ${url}`);
  logger.htpsDirect(` = will connect to ${hostport.join(':')}`);
  // set up TCP connection
  const proxySocket = new net.Socket();
  proxySocket.connect(hostport[1], hostport[0], function() {
    logger.htpsDirect(`  < connected to ${hostport.join(':')}`);
    logger.htpsDirect(`  > writing head of length ${bodyhead.length}`);
    proxySocket.write(bodyhead);
    // tell the caller the connection was successfully established
    socketRequest.write("HTTP/" + httpVersion + " 200 Connection established\r\n\r\n");
  });
  proxySocket.on("data", function(chunk) { // backend -> frontend
    logger.htpsDirect(`  < data length = ${chunk.length}`);
    socketRequest.write(chunk);
  }).on("end", function() { // backend stops frontend
    logger.htpsDirect("  < end");
    socketRequest.end();
  }).on("error", function(err) { // backend stops frontend, due to error
    logger.htpsDirectErr(`${url} - Backend ${err}`);
    socketRequest.write("HTTP/" + httpVersion + " 500 Connection error\r\n\r\n");
    socketRequest.end();
  });
  socketRequest.on("data", function(chunk) { // frontend -> backend
    logger.fsock(`  > data length = ${chunk.length}`);
    proxySocket.write(chunk);
  }).on("end", function() { // frontend stops backend
    logger.fsock("  > end");
    proxySocket.end();
  }).on("error", function(err) { // frontend stops backend, due to error
    if (IGNORE_FRONT_ERR.includes(err.code)) {
      logger.fsock(`  > main direct ${url} ERR: ${err}`);
    } else {
      logger.htpsDirectErr(`${url} - Frontend ${err}`);
      proxySocket.end();
    }
  });
};
