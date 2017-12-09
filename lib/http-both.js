const http = require('http');
const {'Agent': SocksAgent} = require('socks');
const _ = require('underscore');

const {getHostPortFromString, debug} = require('./utils');

const regexPath = /^[a-zA-Z]+:\/\/[^/]+(\/.*)?$/;
// handle a HTTP proxy request
module.exports = function httpUserRequest(gLogger, SYSTEM_PROXY, userRequest, userResponse){
  const {agent, headers, method, url} = userRequest;
  let auth, logger;
  if (SYSTEM_PROXY) {
    auth = new SocksAgent({'proxy': SYSTEM_PROXY},
      false, // we are connecting to a HTTPS server, false for HTTP server
      false); // rejectUnauthorized option passed to tls.connect(). Only when secure is set to true
    logger = _.defaults({
      'htpBoth': debug('http-proxy'),
      'htpBothErr': debug('http-proxy-error')
    }, gLogger);
  } else {
    ({auth} = userRequest);
    logger = _.defaults({
      'htpBoth': debug('http-direct'),
      'htpBothErr': debug('http-direct-error')
    }, gLogger);
  }
  logger.htpBoth(`  > request: ${url}`);
  const hostport = getHostPortFromString(headers.host, 80);
  // have to extract the path from the requested URL
  let path = url;
  const result = regexPath.exec(path);
  if (result != null) {
    if (_.isEmpty(result[1])) {
      path = '/';
    } else {
      path = result[1];
    }
  }
  const options = {
    'host': hostport[0], 'port': hostport[1],
    agent, auth, headers, method, path
  };
  logger.htpBoth(`  > options: ${JSON.stringify(options, null, 2)}`);
  const proxyRequest = http.request(options, proxyResponse => {
    const {statusCode, headers} = proxyResponse;
    logger.htpBoth(`  < response ${statusCode} headers: ${JSON.stringify(headers, null, 2)}`);
    userResponse.writeHead(statusCode, headers);
    proxyResponse.on('data', chunk => {
      logger.htpBoth(`  < chunk = ${chunk.length} bytes`);
      userResponse.write(chunk);
    });
    proxyResponse.on('end', () => {
      logger.htpBoth('  < END');
      userResponse.end();
    });
  }).on('error', error => {
    logger.htpBothErr(`  < user ${url} ERR: ${error}`);
    userResponse.writeHead(500);
    userResponse.write(
      `${'<h1>500 Error</h1>\r\n' +
        '<p>Error was <pre>'}${
        error
      }</pre></p>\r\n` +
        '</body></html>\r\n'
    );
    userResponse.end();
  });
  userRequest.addListener('data', chunk => {
    logger.fsock(`  > chunk = ${chunk.length} bytes`);
    proxyRequest.write(chunk);
  }).addListener('end', () => {
    logger.fsock('  > END');
    proxyRequest.end();
  }).addListener('error', err => {
    logger.htpBothErr(`  > user ${hostport.join(':')} ERR: ${err}`);
    proxyRequest.end();
  });
};
