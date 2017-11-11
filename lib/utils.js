const _ = require('underscore');

const regex_hostport = /^([^:]+)(:([0-9]+))?$/;

_.extendOwn(exports, {
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
  }
});
