const {promisify} = require('util');
const Socks = require('socks');
const _ = require('underscore');

const {getHostPortFromString, IGNORE_FRONT_ERR, debug} = require('./utils');

const createConnection = promisify(Socks.createConnection);

module.exports = async function httpsProxy(gLogger, SYSTEM_PROXY, request, socketRequest, bodyhead){
  const {httpVersion, url, 'client': {remoteAddress}} = request;
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
  proxySocket.on('data', chunk => { // backend -> frontend
    logger.htpsProxy(`  < data length = ${chunk.length}`);
    socketRequest.write(chunk);
  }).on('end', () => { // backend stops frontend
    logger.htpsProxy('  < end');
    socketRequest.end();
  }).on('error', err => { // backend stops frontend, due to error
    logger.htpsProxyErr(`${url} - Backend ${err}`);
    socketRequest.write(`HTTP/${httpVersion} 500 Connection error\r\n\r\n`);
    socketRequest.end();
  });
  proxySocket.write(bodyhead);
  proxySocket.resume();
  // tell the caller the connection was successfully established
  socketRequest.on('data', chunk => { // frontend -> backend
    logger.fsock(`  > data length = ${chunk.length}`);
    proxySocket.write(chunk);
  }).on('end', () => { // frontend stops backend
    logger.fsock('  > end');
    proxySocket.end();
  }).on('error', err => { // frontend stops backend, due to error
    if (IGNORE_FRONT_ERR.includes(err.code)) {
      logger.fsock(`  > main proxy ${url} ERR: ${err}`);
    } else {
      logger.htpsProxyErr(`${url} - Frontend ${err}`);
      proxySocket.end();
    }
  });
  socketRequest.write(`HTTP/${httpVersion} 200 Connection established\r\n\r\n`);
};
