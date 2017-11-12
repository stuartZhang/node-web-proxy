const {promisify} = require('util');
const cluster = require('cluster');
const {ArgumentParser} = require('argparse');
const fs = require('fs');
const path = require('path');
const _ = require('underscore');
const debug = require('debug');
const stripJsonComments = require('strip-json-comments');

const readFile = promisify(fs.readFile);
const regex_hostport = /^([^:]+)(:([0-9]+))?$/;

_.extendOwn(exports, {
  IGNORE_FRONT_ERR: ['ECONNRESET'],
  getHostPortFromString(hostString, defaultPort){
    let host = hostString;
    let port = defaultPort;
    let result = regex_hostport.exec(hostString);
    if (result != null) {
      host = result[1];
      if (result[2] != null) {
        port = result[3];
      }
    }
    return [host, Number(port)];
  },
  async jsonLoad(filePath, replacer){
    const jsonStr = await readFile(filePath);
    return JSON.parse(stripJsonComments(jsonStr.toString()), replacer);
  },
  buildProxyCliArgs(){
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
    parser.addArgument([ '-gwl', '--guest-whitelist' ], {
      action: 'store',
      defaultValue: process.env.GUEST_WHITELIST || path.resolve(__dirname, '../config/guest-whitelist.json'),
      dest: 'gwlFilePath',
      help: 'Only the clients enjoy the paid forward proxy whose ips are in the whitelist file.',
      type: 'string'
    });
    parser.addArgument([ '-pr', '--pac-rules' ], {
      action: 'store',
      defaultValue: process.env.PAC_RULES || path.resolve(__dirname, '../config/pac-rules.json'),
      dest: 'prFilePath',
      help: 'Only the web sites the paid forward proxy whose ips are in the whitelist file.',
      type: 'string'
    });
    return parser.parseArgs();
  },
  buildServiceCliArgs(){
    const parser = new ArgumentParser({
      version: '0.0.1',
      addHelp: true,
      description: 'A HTTP(S) Forward Proxy built upon nodejs'
    });
    parser.addArgument([ '-si', '--service-install' ], {
      action: 'storeTrue',
      dest: 'serviceInstall',
      help: 'Install HTTP(S) Proxy as a system service'
    });
    parser.addArgument([ '-su', '--service-uninstall' ], {
      action: 'storeTrue',
      dest: 'serviceUninstall',
      help: 'Uninstall HTTP(S) Proxy as a system service'
    });
    parser.addArgument([ '-st', '--service-start' ], {
      action: 'storeTrue',
      dest: 'serviceStart',
      help: 'Start the system-service HTTP(S) Proxy'
    });
    parser.addArgument([ '-sp', '--service-stop' ], {
      action: 'storeTrue',
      dest: 'serviceStop',
      help: 'Stop the system-service HTTP(S) Proxy'
    });
    parser.addArgument([ '-sr', '--service-restart' ], {
      action: 'storeTrue',
      dest: 'serviceRestart',
      help: 'Restart the system-service HTTP(S) Proxy'
    });
    parser.addArgument([ '-t', '--trace' ], {
      action: 'storeTrue',
      help: 'Trace the proxy logs'
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
    parser.addArgument([ '-gwl', '--guest-whitelist' ], {
      action: 'store',
      defaultValue: process.env.GUEST_WHITELIST || path.resolve(__dirname, '../config/guest-whitelist.json'),
      dest: 'gwlFilePath',
      help: 'Only the clients enjoy the paid forward proxy whose ips are in the whitelist file.',
      type: 'string'
    });
    parser.addArgument([ '-pr', '--pac-rules' ], {
      action: 'store',
      defaultValue: process.env.PAC_RULES || path.resolve(__dirname, '../config/pac-rules.json'),
      dest: 'prFilePath',
      help: 'Only the web sites the paid forward proxy whose ips are in the whitelist file.',
      type: 'string'
    });
    return [parser.parseArgs(), parser];
  },
  debug(category){
    if (cluster.isWorker) {
      return debug(`[${cluster.worker.process.pid}/${cluster.worker.id}] ${category}`);
    }
    return debug(category);
  }
});
